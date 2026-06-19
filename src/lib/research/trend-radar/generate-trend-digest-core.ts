import "server-only";

import { TrendDigestMode } from "@prisma/client";
import { generateResearchJson } from "@/lib/research/gemini-client";
import {
  buildResearchAiStep,
  type ResearchAiModelStep,
} from "@/lib/research/llm";
import { collectAllTrendSignals } from "@/lib/research/trend-radar/collect-all-trend-signals";
import { clusterTrendSignals } from "@/lib/research/trend-radar/cluster-trends";
import { computeClusteredTrends } from "@/lib/research/trend-radar/compute-tmi";
import {
  applyWowDiff,
  type PriorTrendItem,
} from "@/lib/research/trend-radar/compute-wow-diff";
import {
  buildTrendActionPlanPrompt,
  buildTrendNarrativePrompt,
} from "@/lib/research/trend-radar/prompts/trend-analysis";
import { coerceActionPlan } from "@/lib/research/prescriptive/parse";
import {
  dedupeBrandNames,
  extractForbiddenBrandsFromStrings,
  gatherMarketBrandNames,
  sanitizeRelatedProducts,
} from "@/lib/research/brand-guard";
import type { ActionPlan } from "@/lib/research/prescriptive/types";
import type { TrendSourceConfig } from "@/lib/research/trend-radar/trend-source-config-types";
import { getDefaultTrendSourceConfig } from "@/lib/research/trend-radar/trend-source-config";
import type {
  ClusteredTrend,
  TrendSignalStats,
} from "@/lib/research/trend-radar/trend-signal-types";
import {
  evidenceToLegacySources,
  resolveDigestQuality,
} from "@/lib/research/trend-radar/trend-signal-types";

export function weekBounds(date = new Date()): { weekStart: Date; weekEnd: Date } {
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

export type TrendDigestPipelineResult = {
  digestMode: TrendDigestMode;
  dataNotice: string | null;
  signalStats: TrendSignalStats;
  priorDigestId: string | null;
  narrative: string | null;
  items: ClusteredTrend[];
  actionPlan: ActionPlan | null;
  aiMetaSteps: ResearchAiModelStep[];
  failed: boolean;
};

export async function runTrendDigestPipeline(input: {
  seedKeywords?: string[];
  watchlistName?: string;
  sourceConfig?: TrendSourceConfig;
  priorItems?: PriorTrendItem[];
  priorDigestId?: string | null;
}): Promise<TrendDigestPipelineResult> {
  const sourceConfig = input.sourceConfig ?? getDefaultTrendSourceConfig();
  const { signals, signalStats } = await collectAllTrendSignals({
    seedKeywords: input.seedKeywords,
    sourceConfig,
  });

  const quality = resolveDigestQuality(signalStats.total);
  const aiMetaSteps: ResearchAiModelStep[] = [];

  if (quality.digestMode === "FAILED") {
    return {
      digestMode: "FAILED",
      dataNotice: quality.dataNotice,
      signalStats,
      priorDigestId: input.priorDigestId ?? null,
      narrative: null,
      items: [],
      actionPlan: null,
      aiMetaSteps,
      failed: true,
    };
  }

  const clusters = clusterTrendSignals(signals);
  let items = computeClusteredTrends({
    clusters,
    digestModePartial: quality.digestMode === "PARTIAL",
  });

  if (input.priorItems?.length) {
    items = applyWowDiff(items, input.priorItems);
  }

  if (items.length === 0) {
    return {
      digestMode: "FAILED",
      dataNotice:
        "Sinyal terkumpul tetapi tidak bisa dikluster menjadi tren. Coba perluas watchlist keyword atau aktifkan lebih banyak sumber.",
      signalStats,
      priorDigestId: input.priorDigestId ?? null,
      narrative: null,
      items: [],
      actionPlan: null,
      aiMetaSteps,
      failed: true,
    };
  }

  let narrative = `Digest ${quality.digestMode.toLowerCase()} — ${items.length} tren teridentifikasi dari ${signalStats.total} sinyal.`;
  const marketBrands = await gatherMarketBrandNames();

  try {
    const llmNarrative = await generateResearchJson<{
      narrative?: string;
      items?: { name: string; narrative?: string; relatedProducts?: string[] }[];
    }>(
      buildTrendNarrativePrompt({
        trends: items,
        watchlistName: input.watchlistName,
        seedKeywords: input.seedKeywords,
        forbiddenBrands: marketBrands,
        digestMode: quality.digestMode,
      }),
      { tier: "pro" },
    );
    aiMetaSteps.push(buildResearchAiStep("Narasi tren", "pro"));

    if (llmNarrative.narrative?.trim()) {
      narrative = llmNarrative.narrative.trim();
    }

    if (Array.isArray(llmNarrative.items)) {
      const byName = new Map(
        llmNarrative.items.map((i) => [i.name.toLowerCase(), i]),
      );
      items = items.map((item) => {
        const extra = byName.get(item.name.toLowerCase());
        if (!extra) return item;
        const trendForbiddenBrands = dedupeBrandNames([
          ...marketBrands,
          ...extractForbiddenBrandsFromStrings([item.name]),
        ]);
        return {
          ...item,
          narrative: extra.narrative?.trim() || item.narrative,
          relatedProducts: sanitizeRelatedProducts(
            Array.isArray(extra.relatedProducts)
              ? extra.relatedProducts.map(String)
              : item.relatedProducts,
            trendForbiddenBrands,
          ),
        };
      });
    }
  } catch (err) {
    console.error("[trend-digest-core] narrative LLM gagal", err);
  }

  let actionPlan: ActionPlan | null = null;
  if (quality.digestMode === "LIVE") {
    try {
      const trendForbiddenBrands = dedupeBrandNames([
        ...marketBrands,
        ...extractForbiddenBrandsFromStrings(items.map((i) => i.name)),
      ]);
      const planResult = await generateResearchJson<{ actionPlan?: unknown }>(
        buildTrendActionPlanPrompt({
          narrative,
          items: items.map((i) => ({
            name: i.name,
            dimension: String(i.dimension),
            phase: String(i.phase),
            score: i.tmiScore,
          })),
          forbiddenBrands: trendForbiddenBrands,
        }),
        { tier: "pro" },
      );
      actionPlan = coerceActionPlan(
        planResult.actionPlan,
        "trend-digest",
        trendForbiddenBrands,
      );
      aiMetaSteps.push(buildResearchAiStep("Rencana aksi", "pro"));
    } catch (err) {
      console.error("[trend-digest-core] action plan gagal", err);
    }
  }

  return {
    digestMode: quality.digestMode,
    dataNotice: quality.dataNotice,
    signalStats,
    priorDigestId: input.priorDigestId ?? null,
    narrative,
    items,
    actionPlan,
    aiMetaSteps,
    failed: false,
  };
}

export function clusteredTrendToDbFields(item: ClusteredTrend) {
  return {
    name: item.name,
    dimension: item.dimension,
    phase: item.phase,
    tmiScore: item.tmiScore,
    score: item.tmiScore,
    confidence: item.confidence,
    phaseSource: item.phaseSource,
    wowStatus: item.wowStatus ?? null,
    narrative: item.narrative ?? null,
    isGlobalPipeline: item.isGlobalPipeline,
    evidence: item.evidence,
    sources: evidenceToLegacySources(item.evidence),
    relatedProducts: item.relatedProducts,
  };
}
