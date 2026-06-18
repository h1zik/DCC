import "server-only";

import { KeywordIntelStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateResearchJson } from "@/lib/research/gemini-client";
import {
  buildResearchAiStep,
  researchAiMetaFromSteps,
} from "@/lib/research/llm";
import { collectKeywordSignals } from "@/lib/research/keyword-intel/collect-keywords";
import {
  buildGapKeywordsFromSignals,
  buildKeywordMatrixFromSignals,
  mergeGapReasons,
} from "@/lib/research/keyword-intel/build-keyword-output";
import { buildKeywordAnalysisPrompt } from "@/lib/research/keyword-intel/prompts/keyword-analysis";
import {
  dedupeBrandNames,
  extractForbiddenBrandsFromKeywords,
  gatherMarketBrandNames,
  sanitizeCopyKeywords,
  sanitizeStringArray,
} from "@/lib/research/brand-guard";
import { coerceActionPlan } from "@/lib/research/prescriptive/parse";
import { syncModuleRecommendations } from "@/lib/research/prescriptive/sync";
import type { ActionPlan } from "@/lib/research/prescriptive/types";

type AnalysisResult = {
  intents?: { keyword: string; intent: "transactional" | "informational" }[];
  gapReasons?: { keyword: string; reason: string }[];
  namingSuggestions: string[];
  copyKeywords: {
    listingTitle: string[];
    listingDescription: string[];
    socialMedia: string[];
  };
  seasonalCalendar: { month: string; keywords: string[] }[];
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
    if (row?.keyword && row.intent) {
      map.set(norm(row.keyword), row.intent);
    }
  }
  return map;
}

function reasonMapFromAi(
  reasons: AnalysisResult["gapReasons"],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const row of reasons ?? []) {
    if (row?.keyword && row.reason) {
      map.set(norm(row.keyword), row.reason);
    }
  }
  return map;
}

export async function analyzeBrandKeywordQuery(queryId: string): Promise<void> {
  const query = await prisma.brandKeywordQuery.findUnique({
    where: { id: queryId },
  });
  if (!query) throw new Error("Query keyword tidak ditemukan.");

  await prisma.brandKeywordQuery.update({
    where: { id: queryId },
    data: { status: KeywordIntelStatus.COLLECTING, errorMessage: null },
  });

  try {
    const collected = await collectKeywordSignals({
      category: query.category,
      seedKeyword: query.seedKeyword,
      marketplace: query.marketplace,
    });

    const gapCandidates = buildGapKeywordsFromSignals(collected.signals);

    await prisma.brandKeywordQuery.update({
      where: { id: queryId },
      data: { status: KeywordIntelStatus.ANALYZING },
    });

    const signalKeywords = collected.signals.map((s) => s.keyword);
    const forbiddenBrands = dedupeBrandNames([
      ...(await gatherMarketBrandNames({ category: query.category })),
      ...extractForbiddenBrandsFromKeywords(signalKeywords, query.category),
    ]);

    const prompt = buildKeywordAnalysisPrompt({
      category: query.category,
      seedKeyword: query.seedKeyword,
      signals: collected.signals,
      gapCandidates,
      forbiddenBrands,
    });

    const result = await generateResearchJson<AnalysisResult>(prompt);

    const intents = intentMapFromAi(result.intents);
    const keywordMatrix = buildKeywordMatrixFromSignals(
      collected.signals,
      intents,
    ).sort((a, b) => b.volume - a.volume);

    const gapKeywords = mergeGapReasons(
      gapCandidates,
      reasonMapFromAi(result.gapReasons),
    );

    const copyKeywordsRaw = {
      ...(result.copyKeywords ?? {}),
      _meta: {
        isDemo: collected.isDemo,
        volumeSource: collected.volumeSource,
        dataNotice: collected.dataNotice,
      },
    };
    const copyKeywords = sanitizeCopyKeywords(
      copyKeywordsRaw,
      forbiddenBrands,
    ) as typeof copyKeywordsRaw;

    const actionPlan: ActionPlan | null = coerceActionPlan(
      result.actionPlan,
      `keyword-${queryId}`,
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

    const aiMeta = researchAiMetaFromSteps([
      buildResearchAiStep("Analisis keyword & copy", "flash"),
    ]);

    await prisma.brandKeywordResult.upsert({
      where: { queryId },
      create: {
        queryId,
        keywordMatrix,
        gapKeywords,
        namingSuggestions,
        copyKeywords,
        seasonalCalendar,
        clusters,
        aiSummary: result.aiSummary ?? null,
        aiActionPlan: actionPlan ?? undefined,
        aiMeta: aiMeta as object,
      },
      update: {
        keywordMatrix,
        gapKeywords,
        namingSuggestions,
        copyKeywords,
        seasonalCalendar,
        clusters,
        aiSummary: result.aiSummary ?? null,
        aiActionPlan: actionPlan ?? undefined,
        aiMeta: aiMeta as object,
      },
    });

    await prisma.brandKeywordQuery.update({
      where: { id: queryId },
      data: { status: KeywordIntelStatus.READY },
    });

    await syncModuleRecommendations({
      module: "brand-keyword-intel",
      sourceId: queryId,
      sourceLabel: `Keyword: ${query.category}`,
      href: `/brand-hub/keyword-intel/${queryId}`,
      plan: actionPlan,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Analisis keyword gagal.";
    await prisma.brandKeywordQuery.update({
      where: { id: queryId },
      data: { status: KeywordIntelStatus.FAILED, errorMessage: message },
    });
    throw err;
  }
}

export async function enqueueBrandKeywordAnalysis(queryId: string): Promise<void> {
  await analyzeBrandKeywordQuery(queryId);
}
