import "server-only";

import { ReviewSentiment } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateResearchJson, generateResearchText } from "@/lib/research/gemini-client";
import {
  buildGapOpportunityPrompt,
  buildReviewBatchPrompt,
} from "@/lib/research/prompts/review-analysis";
import { aggregateReviewAnalyses } from "@/lib/research/review-aggregator";

const BATCH_SIZE = 25;

type BatchResult = {
  reviews: {
    idx?: number;
    /** @deprecated Gemini kadang masih mengembalikan id — diabaikan. */
    id?: string;
    sentiment: "POSITIVE" | "NEUTRAL" | "NEGATIVE";
    complaintThemes: string[];
    praiseThemes: string[];
    keywords: string[];
  }[];
};

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
  },
) {
  await prisma.reviewAnalysis.upsert({
    where: { reviewId },
    create: { reviewId, ...data },
    update: data,
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
  for (let i = 0; i < pending.length; i += BATCH_SIZE) {
    const batch = pending.slice(i, i + BATCH_SIZE);
    const prompt = buildReviewBatchPrompt(
      source.productName,
      batch.map((r, batchIdx) => ({
        idx: batchIdx,
        text: r.text,
        rating: r.rating,
      })),
    );

    const covered = new Set<string>();

    let parsed: BatchResult | null = null;
    try {
      parsed = await generateResearchJson<BatchResult>(prompt);
    } catch (err) {
      console.error("[review-analyzer] batch gagal", err);
    }

    if (parsed?.reviews?.length) {
      for (const item of parsed.reviews) {
        const batchIdx =
          typeof item.idx === "number" && Number.isInteger(item.idx)
            ? item.idx
            : -1;
        const review = batchIdx >= 0 ? batch[batchIdx] : undefined;
        if (!review) continue;

        covered.add(review.id);
        await saveReviewAnalysis(review.id, {
          sentiment: toSentiment(item.sentiment),
          complaintThemes: item.complaintThemes ?? [],
          praiseThemes: item.praiseThemes ?? [],
          keywords: item.keywords ?? [],
        });
      }
    }

    for (const review of batch) {
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
    }));

  const agg = aggregateReviewAnalyses(rows);

  let gapOpportunity: string | null = null;
  try {
    gapOpportunity = await generateResearchText(
      buildGapOpportunityPrompt({
        productName: source.productName,
        competitorBrand: source.competitorBrand,
        topComplaints: agg.topComplaints,
        topPraises: agg.topPraises,
        positivePct: agg.positivePct,
        negativePct: agg.negativePct,
      }),
    );
  } catch (err) {
    console.error("[review-analyzer] gap opportunity gagal", err);
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
    },
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
