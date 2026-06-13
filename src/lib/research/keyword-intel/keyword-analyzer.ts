import "server-only";

import { KeywordIntelStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateResearchJson } from "@/lib/research/gemini-client";
import { collectKeywordSignals } from "@/lib/research/keyword-intel/collect-keywords";
import {
  buildGapKeywordsFromSignals,
  buildKeywordMatrixFromSignals,
  mergeGapReasons,
} from "@/lib/research/keyword-intel/build-keyword-output";
import { buildKeywordAnalysisPrompt } from "@/lib/research/keyword-intel/prompts/keyword-analysis";

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

export async function analyzeKeywordQuery(queryId: string): Promise<void> {
  const query = await prisma.keywordIntelQuery.findUnique({
    where: { id: queryId },
  });
  if (!query) throw new Error("Query keyword tidak ditemukan.");

  await prisma.keywordIntelQuery.update({
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

    await prisma.keywordIntelQuery.update({
      where: { id: queryId },
      data: { status: KeywordIntelStatus.ANALYZING },
    });

    const prompt = buildKeywordAnalysisPrompt({
      category: query.category,
      seedKeyword: query.seedKeyword,
      signals: collected.signals,
      gapCandidates,
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

    const copyKeywords = {
      ...(result.copyKeywords ?? {}),
      _meta: {
        isDemo: collected.isDemo,
        volumeSource: collected.volumeSource,
        dataNotice: collected.dataNotice,
      },
    };

    await prisma.keywordIntelResult.upsert({
      where: { queryId },
      create: {
        queryId,
        keywordMatrix,
        gapKeywords,
        namingSuggestions: result.namingSuggestions ?? [],
        copyKeywords,
        seasonalCalendar: result.seasonalCalendar ?? [],
        clusters: result.clusters ?? [],
        aiSummary: result.aiSummary ?? null,
      },
      update: {
        keywordMatrix,
        gapKeywords,
        namingSuggestions: result.namingSuggestions ?? [],
        copyKeywords,
        seasonalCalendar: result.seasonalCalendar ?? [],
        clusters: result.clusters ?? [],
        aiSummary: result.aiSummary ?? null,
      },
    });

    await prisma.keywordIntelQuery.update({
      where: { id: queryId },
      data: { status: KeywordIntelStatus.READY },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Analisis keyword gagal.";
    await prisma.keywordIntelQuery.update({
      where: { id: queryId },
      data: { status: KeywordIntelStatus.FAILED, errorMessage: message },
    });
    throw err;
  }
}

export async function enqueueKeywordAnalysis(queryId: string): Promise<void> {
  await analyzeKeywordQuery(queryId);
}
