import "server-only";

import {
  TrendDimension,
  TrendPhase,
  TrendRadarStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateResearchJson } from "@/lib/research/gemini-client";
import {
  buildResearchAiStep,
  researchAiMetaFromSteps,
} from "@/lib/research/llm";
import { collectTrendSources } from "@/lib/research/trend-radar/collect-sources";
import { generateDemoTrendItems } from "@/lib/research/trend-radar/demo-trends";
import {
  buildTrendActionPlanPrompt,
  buildTrendAnalysisPrompt,
} from "@/lib/research/trend-radar/prompts/trend-analysis";
import {
  clampTrendScore,
  normalizeTrendDimension,
  normalizeTrendPhase,
} from "@/lib/research/trend-radar/normalize-trend";
import { enrichTrendPhases } from "@/lib/research/trend-radar/phase-enrichment";
import { coerceActionPlan } from "@/lib/research/prescriptive/parse";
import {
  dedupeBrandNames,
  extractForbiddenBrandsFromStrings,
  gatherMarketBrandNames,
  sanitizeRelatedProducts,
} from "@/lib/research/brand-guard";
import { syncModuleRecommendations } from "@/lib/research/prescriptive/sync";
import type { ActionPlan } from "@/lib/research/prescriptive/types";
import type { TrendSourceConfig } from "@/lib/research/trend-radar/trend-source-config-types";
import { getDefaultTrendSourceConfig } from "@/lib/research/trend-radar/trend-source-config";

type TrendAnalysisResult = {
  narrative: string;
  items: {
    name: string;
    dimension: TrendDimension;
    phase: TrendPhase;
    score: number;
    narrative: string;
    isGlobalPipeline: boolean;
    sources: { type: string; snippet: string; url?: string }[];
    relatedProducts: string[];
  }[];
};

function weekBounds(date = new Date()): { weekStart: Date; weekEnd: Date } {
  const d = new Date(date);
  const day = d.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const weekStart = new Date(d);
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(d.getDate() + diffToMonday);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);
  return { weekStart, weekEnd };
}

export async function generateBrandTrendDigest(input: {
  digestId?: string;
  isGlobal: boolean;
  ownerBrandId?: string | null;
  seedKeywords?: string[];
  digestLabel?: string;
  sourceConfig?: TrendSourceConfig;
}): Promise<string> {
  const { weekStart, weekEnd } = weekBounds();
  const sourceConfig = input.sourceConfig ?? getDefaultTrendSourceConfig();

  let digestId = input.digestId;
  if (!digestId) {
    const digest = await prisma.brandTrendDigest.create({
      data: {
        weekStart,
        weekEnd,
        isGlobal: input.isGlobal,
        ownerBrandId: input.ownerBrandId ?? null,
        status: TrendRadarStatus.COLLECTING,
        sourceConfig: sourceConfig as object,
      },
    });
    digestId = digest.id;
  } else {
    await prisma.brandTrendDigest.update({
      where: { id: digestId },
      data: {
        status: TrendRadarStatus.COLLECTING,
        errorMessage: null,
        sourceConfig: sourceConfig as object,
      },
    });
    await prisma.brandTrendSignal.deleteMany({ where: { digestId } });
  }

  try {
    const collected = await collectTrendSources(
      input.seedKeywords ?? [],
      sourceConfig,
    );

    await prisma.brandTrendDigest.update({
      where: { id: digestId },
      data: { status: TrendRadarStatus.ANALYZING },
    });

    let result: TrendAnalysisResult;

    if (collected.signals.length < 3) {
      const demo = generateDemoTrendItems();
      result = {
        narrative:
          "Ringkasan tren demo — sumber eksternal terbatas. Data berikut representatif untuk kategori beauty Indonesia.",
        items: demo,
      };
    } else {
      const marketBrands = await gatherMarketBrandNames();
      const prompt = buildTrendAnalysisPrompt({
        signals: collected.signals,
        watchlistName: input.digestLabel,
        seedKeywords: input.seedKeywords,
        forbiddenBrands: marketBrands,
      });
      result = await generateResearchJson<TrendAnalysisResult>(prompt, {
        tier: "pro",
      });
    }

    if (!result.items?.length) {
      const demo = generateDemoTrendItems();
      result.items = demo;
    }

    const finalizedItems =
      collected.signals.length >= 3
        ? enrichTrendPhases(result.items, collected.signals)
        : result.items;

    const marketBrandsForSanitize = await gatherMarketBrandNames();
    const trendForbiddenBrands = dedupeBrandNames([
      ...marketBrandsForSanitize,
      ...extractForbiddenBrandsFromStrings(
        finalizedItems.flatMap((i) => [
          String(i.name),
          ...(Array.isArray(i.relatedProducts)
            ? i.relatedProducts.map(String)
            : []),
        ]),
      ),
    ]);

    const sanitizedItems = finalizedItems.map((item) => ({
      ...item,
      relatedProducts: sanitizeRelatedProducts(
        Array.isArray(item.relatedProducts)
          ? item.relatedProducts.map(String)
          : [],
        trendForbiddenBrands,
      ),
    }));

    await prisma.brandTrendSignal.createMany({
      data: sanitizedItems.map((item) => ({
        digestId: digestId!,
        name: String(item.name).slice(0, 200),
        dimension: normalizeTrendDimension(item.dimension),
        phase: normalizeTrendPhase(item.phase),
        score: clampTrendScore(item.score),
        narrative: item.narrative ?? null,
        isGlobalPipeline: Boolean(item.isGlobalPipeline),
        sources: Array.isArray(item.sources) ? item.sources : [],
        relatedProducts: item.relatedProducts,
      })),
    });

    let actionPlan: ActionPlan | null = null;
    const aiMetaSteps = [];
    if (collected.signals.length >= 3) {
      aiMetaSteps.push(buildResearchAiStep("Analisis tren", "pro"));
    }
    try {
      const forbiddenBrands = trendForbiddenBrands;

      const planResult = await generateResearchJson<{ actionPlan?: unknown }>(
        buildTrendActionPlanPrompt({
          narrative: result.narrative,
          items: sanitizedItems.map((i) => ({
            name: String(i.name),
            dimension: String(i.dimension),
            phase: String(i.phase),
            score: clampTrendScore(i.score),
          })),
          forbiddenBrands,
        }),
        { tier: "pro" },
      );
      actionPlan = coerceActionPlan(
        planResult.actionPlan,
        `trend-${digestId}`,
        forbiddenBrands,
      );
      aiMetaSteps.push(buildResearchAiStep("Rencana aksi", "pro"));
    } catch (err) {
      console.error("[trend-analyzer] action plan gagal", err);
    }

    await prisma.brandTrendDigest.update({
      where: { id: digestId },
      data: {
        status: TrendRadarStatus.READY,
        narrative: result.narrative,
        generatedAt: new Date(),
        weekStart,
        weekEnd,
        aiActionPlan: actionPlan ?? undefined,
        aiMeta:
          aiMetaSteps.length > 0
            ? (researchAiMetaFromSteps(aiMetaSteps) as object)
            : undefined,
      },
    });

    if (input.isGlobal) {
      await syncModuleRecommendations({
        module: "brand-trend-radar",
        sourceId: digestId,
        sourceLabel: "Trend Radar (mingguan)",
        href: `/brand-hub/trend-radar/${digestId}`,
        plan: actionPlan,
      });
    }

    return digestId;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Generate digest gagal.";
    await prisma.brandTrendDigest.update({
      where: { id: digestId },
      data: { status: TrendRadarStatus.FAILED, errorMessage: message },
    });
    throw err;
  }
}
