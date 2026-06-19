import "server-only";

import { KeywordIntelStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { runKeywordIntelPipeline } from "@/lib/research/keyword-intel/generate-keyword-intel-core";
import {
  parseKeywordSourceConfigJson,
  resolveKeywordSourceConfig,
} from "@/lib/research/keyword-intel/keyword-source-config";
import { researchAiMetaFromSteps } from "@/lib/research/llm";
import { syncModuleRecommendations } from "@/lib/research/prescriptive/sync";

export async function analyzeBrandKeywordQuery(queryId: string): Promise<void> {
  const query = await prisma.brandKeywordQuery.findUnique({
    where: { id: queryId },
    include: { result: true },
  });
  if (!query) throw new Error("Query keyword tidak ditemukan.");

  await prisma.brandKeywordQuery.update({
    where: { id: queryId },
    data: { status: KeywordIntelStatus.COLLECTING, errorMessage: null },
  });

  try {
    const priorMatrix = query.result
      ? (Array.isArray(query.result.keywordMatrix)
          ? (query.result.keywordMatrix as { keyword?: string; koiScore?: number }[])
          : []
        )
          .filter((r) => r.keyword)
          .map((r) => ({ keyword: r.keyword!, koiScore: r.koiScore ?? null }))
      : query.priorQueryId != null
        ? await loadPriorMatrix(query.priorQueryId)
        : [];

    await prisma.brandKeywordResult.deleteMany({ where: { queryId } });

    const sourceConfig = resolveKeywordSourceConfig(
      parseKeywordSourceConfigJson(query.sourceConfig),
    );

    await prisma.brandKeywordQuery.update({
      where: { id: queryId },
      data: { status: KeywordIntelStatus.ANALYZING },
    });

    const pipeline = await runKeywordIntelPipeline({
      category: query.category,
      seedKeyword: query.seedKeyword,
      marketplace: query.marketplace,
      sourceConfig,
      priorMatrix,
      queryIdForPlan: queryId,
    });

    const aiMeta = researchAiMetaFromSteps(pipeline.aiMetaSteps);

    await prisma.brandKeywordResult.upsert({
      where: { queryId },
      create: {
        queryId,
        keywordMatrix: pipeline.matrix,
        gapKeywords: pipeline.gapKeywords,
        namingSuggestions: pipeline.namingSuggestions,
        copyKeywords: pipeline.copyKeywords,
        seasonalCalendar: pipeline.seasonalCalendar,
        seasonalCurves: pipeline.seasonalCurves,
        clusters: pipeline.clusters,
        aiSummary: pipeline.aiSummary,
        aiActionPlan: pipeline.actionPlan ?? undefined,
        aiMeta: aiMeta as object,
      },
      update: {
        keywordMatrix: pipeline.matrix,
        gapKeywords: pipeline.gapKeywords,
        namingSuggestions: pipeline.namingSuggestions,
        copyKeywords: pipeline.copyKeywords,
        seasonalCalendar: pipeline.seasonalCalendar,
        seasonalCurves: pipeline.seasonalCurves,
        clusters: pipeline.clusters,
        aiSummary: pipeline.aiSummary,
        aiActionPlan: pipeline.actionPlan ?? undefined,
        aiMeta: aiMeta as object,
      },
    });

    await prisma.brandKeywordQuery.update({
      where: { id: queryId },
      data: {
        status: KeywordIntelStatus.READY,
        digestMode: "LIVE",
        signalStats: pipeline.signalStats as object,
        dataNotice: pipeline.dataNotice,
        volumeSource: pipeline.quality.volumeSource,
        errorMessage: null,
      },
    });

    await syncModuleRecommendations({
      module: "brand-keyword-intel",
      sourceId: queryId,
      sourceLabel: `Keyword: ${query.category}`,
      href: `/brand-hub/keyword-intel/${queryId}`,
      plan: pipeline.actionPlan,
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

async function loadPriorMatrix(priorQueryId: string) {
  const prior = await prisma.brandKeywordResult.findUnique({
    where: { queryId: priorQueryId },
  });
  if (!prior || !Array.isArray(prior.keywordMatrix)) return [];
  return (prior.keywordMatrix as { keyword?: string; koiScore?: number }[])
    .filter((r) => r.keyword)
    .map((r) => ({
      keyword: r.keyword!,
      koiScore: r.koiScore ?? null,
    }));
}

export async function enqueueBrandKeywordAnalysis(queryId: string): Promise<void> {
  await analyzeBrandKeywordQuery(queryId);
}
