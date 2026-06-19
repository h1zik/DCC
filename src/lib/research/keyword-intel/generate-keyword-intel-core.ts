import "server-only";

import { generateResearchJson } from "@/lib/research/gemini-client";
import {
  buildResearchAiStep,
  type ResearchAiModelStep,
} from "@/lib/research/llm";
import { collectAllKeywordSignals } from "@/lib/research/keyword-intel/collect-all-keyword-signals";
import { collectMarketplaceDensity } from "@/lib/research/keyword-intel/collect-marketplace-density";
import {
  buildGapKeywordsFromMatrix,
  buildKeywordMatrixFromSignals,
  mergeGapReasons,
} from "@/lib/research/keyword-intel/build-keyword-output";
import {
  applyKeywordDiff,
  type PriorKeywordRow,
} from "@/lib/research/keyword-intel/compute-keyword-diff";
import { preliminaryKeywordScore } from "@/lib/research/keyword-intel/compute-koi";
import { fetchHistoricalSeasonality } from "@/lib/research/keyword-intel/fetch-historical-seasonality";
import { buildKeywordAnalysisPrompt } from "@/lib/research/keyword-intel/prompts/keyword-analysis";
import {
  enforceKeywordSourcePolicy,
  getDefaultKeywordSourceConfig,
  type KeywordSourceConfig,
} from "@/lib/research/keyword-intel/keyword-source-config";
import type {
  GapKeywordRow,
  KeywordDataQuality,
  KeywordMatrixRow,
  KeywordSignalStats,
  SeasonalCurve,
} from "@/lib/research/keyword-intel/keyword-signal-types";
import { resolveKeywordQuality } from "@/lib/research/keyword-intel/keyword-signal-types";
import {
  dedupeBrandNames,
  extractForbiddenBrandsFromKeywords,
  gatherMarketBrandNames,
  sanitizeCopyKeywords,
  sanitizeStringArray,
} from "@/lib/research/brand-guard";
import { coerceActionPlan } from "@/lib/research/prescriptive/parse";
import type { ActionPlan } from "@/lib/research/prescriptive/types";
import { ResearchMarketplace } from "@prisma/client";

type AnalysisResult = {
  intents?: { keyword: string; intent: "transactional" | "informational" }[];
  gapReasons?: { keyword: string; reason: string }[];
  namingSuggestions: string[];
  copyKeywords: {
    listingTitle: string[];
    listingDescription: string[];
    socialMedia: string[];
  };
  seasonalCalendar: { month: string; keywords: string[]; event?: string }[];
  clusters: { name: string; keywords: string[] }[];
  aiSummary: string;
  actionPlan?: unknown;
};

function norm(keyword: string): string {
  return keyword.trim().toLowerCase();
}

function intentMapFromAi(
  intents: AnalysisResult["intents"],
): Map<string, "transactional" | "informational"> {
  const map = new Map<string, "transactional" | "informational">();
  for (const row of intents ?? []) {
    if (row?.keyword && row.intent) map.set(norm(row.keyword), row.intent);
  }
  return map;
}

function reasonMapFromAi(
  reasons: AnalysisResult["gapReasons"],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const row of reasons ?? []) {
    if (row?.keyword && row.reason) map.set(norm(row.keyword), row.reason);
  }
  return map;
}

export type KeywordIntelPipelineResult = {
  quality: KeywordDataQuality;
  signalStats: KeywordSignalStats;
  dataNotice: string | null;
  matrix: KeywordMatrixRow[];
  gapKeywords: GapKeywordRow[];
  namingSuggestions: string[];
  copyKeywords: AnalysisResult["copyKeywords"];
  seasonalCalendar: AnalysisResult["seasonalCalendar"];
  seasonalCurves: SeasonalCurve[];
  clusters: AnalysisResult["clusters"];
  aiSummary: string | null;
  actionPlan: ActionPlan | null;
  aiMetaSteps: ResearchAiModelStep[];
};

export async function runKeywordIntelPipeline(input: {
  category: string;
  seedKeyword?: string | null;
  marketplace?: ResearchMarketplace | null;
  sourceConfig?: KeywordSourceConfig;
  priorMatrix?: PriorKeywordRow[];
  queryIdForPlan?: string;
}): Promise<KeywordIntelPipelineResult> {
  const sourceConfig = enforceKeywordSourcePolicy(
    input.sourceConfig ?? getDefaultKeywordSourceConfig(),
  );
  const aiMetaSteps: ResearchAiModelStep[] = [];

  const collected = await collectAllKeywordSignals({
    category: input.category,
    seedKeyword: input.seedKeyword,
    marketplace: input.marketplace,
    sourceConfig,
  });

  let signals = collected.signals;
  let signalStats = collected.signalStats;
  let dataNotice = collected.dataNotice;

  const quality = resolveKeywordQuality({
    signalCount: signalStats.total,
    volumeKeywordCount: collected.volumeKeywordCount,
  });

  if (sourceConfig.enabled.shopeeSearch && signals.length > 0) {
    const ranked = [...signals].sort(
      (a, b) => preliminaryKeywordScore(b) - preliminaryKeywordScore(a),
    );
    const density = await collectMarketplaceDensity({
      keywords: ranked.map((s) => s.keyword),
      enabled: true,
    });
    for (const ds of density.signals) {
      const idx = signals.findIndex(
        (s) => s.keyword.toLowerCase() === ds.keyword.toLowerCase(),
      );
      if (idx >= 0) {
        signals[idx] = { ...signals[idx]!, ...ds };
      } else {
        signals.push(ds);
      }
    }
    signalStats = {
      ...signalStats,
      external: {
        ...signalStats.external,
        shopeeSearch: density.signals.length,
      },
      total: signals.length,
    };
  }

  const signalKeywords = signals.map((s) => s.keyword);
  const forbiddenBrands = dedupeBrandNames([
    ...(await gatherMarketBrandNames({ category: input.category })),
    ...extractForbiddenBrandsFromKeywords(signalKeywords, input.category),
  ]);

  const gapCandidatesPre = buildGapKeywordsFromMatrix(
    buildKeywordMatrixFromSignals(signals, new Map(), {
      allSignals: signals,
    }),
    signals,
  );

  const prompt = buildKeywordAnalysisPrompt({
    category: input.category,
    seedKeyword: input.seedKeyword,
    signals,
    gapCandidates: gapCandidatesPre,
    forbiddenBrands,
  });

  const result = await generateResearchJson<AnalysisResult>(prompt);
  aiMetaSteps.push(buildResearchAiStep("Analisis keyword & copy", "flash"));

  const intents = intentMapFromAi(result.intents);
  let matrix = buildKeywordMatrixFromSignals(signals, intents, {
    allSignals: signals,
  }).sort((a, b) => (b.koiScore ?? 0) - (a.koiScore ?? 0));

  if (input.priorMatrix?.length) {
    matrix = applyKeywordDiff(matrix, input.priorMatrix);
  }

  const gapKeywords = mergeGapReasons(
    buildGapKeywordsFromMatrix(matrix, signals),
    reasonMapFromAi(result.gapReasons),
  );

  const topForSeason = matrix
    .slice(0, 8)
    .map((m) => m.keyword);
  const seasonalCurves = await fetchHistoricalSeasonality(topForSeason);

  const copyKeywords = sanitizeCopyKeywords(
    result.copyKeywords ?? {
      listingTitle: [],
      listingDescription: [],
      socialMedia: [],
    },
    forbiddenBrands,
  ) as AnalysisResult["copyKeywords"];

  const actionPlan: ActionPlan | null = coerceActionPlan(
    result.actionPlan,
    `keyword-${input.queryIdForPlan ?? "run"}`,
    forbiddenBrands,
  );

  const namingSuggestions = sanitizeStringArray(
    result.namingSuggestions ?? [],
    forbiddenBrands,
  );
  const seasonalCalendar = (result.seasonalCalendar ?? []).map((row) => ({
    ...row,
    keywords: sanitizeStringArray(row.keywords, forbiddenBrands),
  }));
  const clusters = (result.clusters ?? []).map((c) => ({
    ...c,
    keywords: sanitizeStringArray(c.keywords, forbiddenBrands),
  }));

  const mergedNotice = [quality.dataNotice, dataNotice].filter(Boolean).join(" ") || null;

  return {
    quality: { ...quality, dataNotice: mergedNotice },
    signalStats,
    dataNotice: mergedNotice,
    matrix,
    gapKeywords,
    namingSuggestions,
    copyKeywords,
    seasonalCalendar,
    seasonalCurves,
    clusters,
    aiSummary: result.aiSummary ?? null,
    actionPlan,
    aiMetaSteps,
  };
}
