import "server-only";

import { KeywordIntelStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateResearchJson } from "@/lib/research/gemini-client";
import { collectKeywordSignals } from "@/lib/research/keyword-intel/collect-keywords";
import { buildKeywordAnalysisPrompt } from "@/lib/research/keyword-intel/prompts/keyword-analysis";

type AnalysisResult = {
  keywordMatrix: {
    keyword: string;
    volume: number;
    competition: number;
    trend: "up" | "down" | "stable";
    intent: "transactional" | "informational";
    source: string[];
  }[];
  gapKeywords: {
    keyword: string;
    volume: number;
    competition: number;
    reason: string;
  }[];
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
    const signals = await collectKeywordSignals({
      category: query.category,
      seedKeyword: query.seedKeyword,
      marketplace: query.marketplace,
    });

    await prisma.keywordIntelQuery.update({
      where: { id: queryId },
      data: { status: KeywordIntelStatus.ANALYZING },
    });

    const prompt = buildKeywordAnalysisPrompt({
      category: query.category,
      seedKeyword: query.seedKeyword,
      signals,
    });

    const result = await generateResearchJson<AnalysisResult>(prompt);

    await prisma.keywordIntelResult.upsert({
      where: { queryId },
      create: {
        queryId,
        keywordMatrix: result.keywordMatrix ?? [],
        gapKeywords: result.gapKeywords ?? [],
        namingSuggestions: result.namingSuggestions ?? [],
        copyKeywords: result.copyKeywords ?? {},
        seasonalCalendar: result.seasonalCalendar ?? [],
        clusters: result.clusters ?? [],
        aiSummary: result.aiSummary ?? null,
      },
      update: {
        keywordMatrix: result.keywordMatrix ?? [],
        gapKeywords: result.gapKeywords ?? [],
        namingSuggestions: result.namingSuggestions ?? [],
        copyKeywords: result.copyKeywords ?? {},
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
