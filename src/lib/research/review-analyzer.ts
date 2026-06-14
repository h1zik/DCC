import "server-only";

import { ReviewSentiment } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateResearchJson } from "@/lib/research/gemini-client";
import {
  buildResearchAiStep,
  mergeResearchAiMeta,
  researchAiMetaFromSteps,
} from "@/lib/research/llm";
import {
  buildReviewActionPlanPrompt,
  buildReviewBatchPrompt,
} from "@/lib/research/prompts/review-analysis";
import {
  aggregateReviewAnalyses,
  type DemographicHints,
} from "@/lib/research/review-aggregator";
import { coerceActionPlan } from "@/lib/research/prescriptive/parse";
import { syncModuleRecommendations } from "@/lib/research/prescriptive/sync";
import type { ActionPlan } from "@/lib/research/prescriptive/types";

const BATCH_SIZE = 25;

/** Legacy placeholder dari scraper internal lama — skip Gemini untuk baris ini. */
const RATING_ONLY_PLACEHOLDER = "(Rating tanpa komentar teks)";

function isRatingOnlyReviewText(text: string): boolean {
  return text.trim() === RATING_ONLY_PLACEHOLDER;
}

type BatchResult = {
  reviews: {
    idx?: number;
    /** @deprecated Gemini kadang masih mengembalikan id — diabaikan. */
    id?: string;
    sentiment: "POSITIVE" | "NEUTRAL" | "NEGATIVE";
    complaintThemes: string[];
    praiseThemes: string[];
    keywords: string[];
    complaintSeverity?: number | null;
    demographicHints?: DemographicHints | null;
    pricePerception?: string | null;
    repeatPurchaseSignal?: boolean | null;
  }[];
};

function clampSeverity(value: unknown): number | null {
  if (typeof value !== "number" || Number.isNaN(value)) return null;
  return Math.max(1, Math.min(5, Math.round(value)));
}

function cleanDemographics(
  raw: DemographicHints | null | undefined,
): DemographicHints | null {
  if (!raw || typeof raw !== "object") return null;
  const norm = (v: unknown) =>
    typeof v === "string" && v.trim() && v.trim().toLowerCase() !== "null"
      ? v.trim().toLowerCase()
      : null;
  const ageBand = norm(raw.ageBand);
  const skinType = norm(raw.skinType);
  const gender = norm(raw.gender);
  if (!ageBand && !skinType && !gender) return null;
  return { ageBand, skinType, gender };
}

function toSentiment(s: string): ReviewSentiment {
  if (s === "NEGATIVE") return ReviewSentiment.NEGATIVE;
  if (s === "NEUTRAL") return ReviewSentiment.NEUTRAL;
  return ReviewSentiment.POSITIVE;
}

function fallbackSentiment(rating: number | null): ReviewSentiment {
  if (rating != null) {
    if (rating >= 4) return ReviewSentiment.POSITIVE;
    if (rating <= 2) return ReviewSentiment.NEGATIVE;
  }
  return ReviewSentiment.NEUTRAL;
}

async function saveReviewAnalysis(
  reviewId: string,
  data: {
    sentiment: ReviewSentiment;
    complaintThemes: string[];
    praiseThemes: string[];
    keywords: string[];
    complaintSeverity?: number | null;
    demographicHints?: DemographicHints | null;
    pricePerception?: string | null;
    repeatPurchaseSignal?: boolean | null;
  },
) {
  const payload = {
    sentiment: data.sentiment,
    complaintThemes: data.complaintThemes,
    praiseThemes: data.praiseThemes,
    keywords: data.keywords,
    complaintSeverity: data.complaintSeverity ?? null,
    demographicHints: data.demographicHints ?? undefined,
    pricePerception: data.pricePerception ?? null,
    repeatPurchaseSignal: data.repeatPurchaseSignal ?? null,
  };
  await prisma.reviewAnalysis.upsert({
    where: { reviewId },
    create: { reviewId, ...payload },
    update: payload,
  });
}

export async function analyzeReviewSource(sourceId: string): Promise<void> {
  const source = await prisma.reviewIntelSource.findUnique({
    where: { id: sourceId },
    include: {
      reviews: {
        where: { analysis: null },
        select: { id: true, text: true, rating: true, reviewDate: true },
      },
    },
  });

  if (!source) throw new Error("Sumber review tidak ditemukan.");

  await prisma.reviewIntelSource.update({
    where: { id: sourceId },
    data: { status: "ANALYZING", errorMessage: null },
  });

  const pending = source.reviews;
  let aiMeta = researchAiMetaFromSteps([]);
  let usedFlashBatch = false;

  for (let i = 0; i < pending.length; i += BATCH_SIZE) {
    const batch = pending.slice(i, i + BATCH_SIZE);
    const covered = new Set<string>();

    const ratingOnly = batch.filter((r) => isRatingOnlyReviewText(r.text));
    for (const review of ratingOnly) {
      covered.add(review.id);
      await saveReviewAnalysis(review.id, {
        sentiment: fallbackSentiment(review.rating),
        complaintThemes: [],
        praiseThemes: [],
        keywords: [],
      });
    }

    const forAi = batch.filter((r) => !isRatingOnlyReviewText(r.text));
    if (forAi.length === 0) continue;

    const prompt = buildReviewBatchPrompt(
      source.productName,
      forAi.map((r, batchIdx) => ({
        idx: batchIdx,
        text: r.text,
        rating: r.rating,
      })),
    );

    let parsed: BatchResult | null = null;
    try {
      parsed = await generateResearchJson<BatchResult>(prompt);
    } catch (err) {
      console.error("[review-analyzer] batch gagal", err);
    }

    if (parsed?.reviews?.length) {
      if (!usedFlashBatch) {
        aiMeta = mergeResearchAiMeta(
          aiMeta,
          buildResearchAiStep("Klasifikasi review", "flash"),
        );
        usedFlashBatch = true;
      }
      for (const item of parsed.reviews) {
        const batchIdx =
          typeof item.idx === "number" && Number.isInteger(item.idx)
            ? item.idx
            : -1;
        const review = batchIdx >= 0 ? forAi[batchIdx] : undefined;
        if (!review) continue;

        covered.add(review.id);
        await saveReviewAnalysis(review.id, {
          sentiment: toSentiment(item.sentiment),
          complaintThemes: item.complaintThemes ?? [],
          praiseThemes: item.praiseThemes ?? [],
          keywords: item.keywords ?? [],
          complaintSeverity: clampSeverity(item.complaintSeverity),
          demographicHints: cleanDemographics(item.demographicHints),
          pricePerception:
            typeof item.pricePerception === "string"
              ? item.pricePerception
              : null,
          repeatPurchaseSignal: item.repeatPurchaseSignal ?? null,
        });
      }
    }

    for (const review of forAi) {
      if (covered.has(review.id)) continue;
      await saveReviewAnalysis(review.id, {
        sentiment: fallbackSentiment(review.rating),
        complaintThemes: [],
        praiseThemes: [],
        keywords: [],
      });
    }
  }

  const analyzed = await prisma.reviewRaw.findMany({
    where: { sourceId },
    include: { analysis: true },
  });

  const rows = analyzed
    .filter((r) => r.analysis)
    .map((r) => ({
      sentiment: r.analysis!.sentiment,
      complaintThemes: r.analysis!.complaintThemes,
      praiseThemes: r.analysis!.praiseThemes,
      keywords: r.analysis!.keywords,
      reviewDate: r.reviewDate,
      complaintSeverity: r.analysis!.complaintSeverity,
      demographicHints:
        (r.analysis!.demographicHints as DemographicHints | null) ?? null,
    }));

  const agg = aggregateReviewAnalyses(rows);

  let gapOpportunity: string | null = null;
  let actionPlan: ActionPlan | null = null;
  try {
    const aiResult = await generateResearchJson<{
      gapOpportunity?: string;
      actionPlan?: unknown;
    }>(
      buildReviewActionPlanPrompt({
        productName: source.productName,
        competitorBrand: source.competitorBrand,
        topComplaints: agg.topComplaints,
        topPraises: agg.topPraises,
        severityByTheme: agg.severityByTheme,
        demographics: {
          skinTypes: agg.demographics.skinTypes.map((s) => s.value),
          ageBands: agg.demographics.ageBands.map((s) => s.value),
        },
        positivePct: agg.positivePct,
        negativePct: agg.negativePct,
      }),
      { tier: "pro" },
    );
    gapOpportunity = aiResult.gapOpportunity?.trim() || null;
    actionPlan = coerceActionPlan(aiResult.actionPlan, `review-${sourceId}`);
    aiMeta = mergeResearchAiMeta(
      aiMeta,
      buildResearchAiStep("Gap opportunity & rencana aksi", "pro"),
    );
  } catch (err) {
    console.error("[review-analyzer] action plan gagal", err);
  }

  await prisma.reviewIntelSummary.upsert({
    where: { sourceId },
    create: {
      sourceId,
      positivePct: agg.positivePct,
      neutralPct: agg.neutralPct,
      negativePct: agg.negativePct,
      topComplaints: agg.topComplaints,
      topPraises: agg.topPraises,
      keywordCloud: agg.keywordCloud,
      timelineBuckets: agg.timelineBuckets,
      gapOpportunity,
      severityByTheme: agg.severityByTheme,
      demographics: agg.demographics,
      aiActionPlan: actionPlan ?? undefined,
      aiMeta: aiMeta.steps.length > 0 ? (aiMeta as object) : undefined,
    },
    update: {
      positivePct: agg.positivePct,
      neutralPct: agg.neutralPct,
      negativePct: agg.negativePct,
      topComplaints: agg.topComplaints,
      topPraises: agg.topPraises,
      keywordCloud: agg.keywordCloud,
      timelineBuckets: agg.timelineBuckets,
      gapOpportunity,
      severityByTheme: agg.severityByTheme,
      demographics: agg.demographics,
      aiActionPlan: actionPlan ?? undefined,
      aiMeta: aiMeta.steps.length > 0 ? (aiMeta as object) : undefined,
    },
  });

  await syncModuleRecommendations({
    module: "review-intelligence",
    sourceId,
    sourceLabel: `${source.competitorBrand} · ${source.productName}`,
    href: `/research-hub/review-intelligence/${sourceId}`,
    plan: actionPlan,
  });

  await prisma.reviewIntelSource.update({
    where: { id: sourceId },
    data: {
      status: "READY",
      lastAnalyzedAt: new Date(),
      reviewCount: analyzed.length,
      errorMessage: null,
    },
  });
}
