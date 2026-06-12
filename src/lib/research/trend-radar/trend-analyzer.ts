import "server-only";

import {
  TrendDimension,
  TrendPhase,
  TrendRadarStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateResearchJson } from "@/lib/research/gemini-client";
import { collectTrendSources } from "@/lib/research/trend-radar/collect-sources";
import { generateDemoTrendItems } from "@/lib/research/trend-radar/demo-trends";
import { buildTrendAnalysisPrompt } from "@/lib/research/trend-radar/prompts/trend-analysis";
import {
  clampTrendScore,
  normalizeTrendDimension,
  normalizeTrendPhase,
} from "@/lib/research/trend-radar/normalize-trend";
import { enrichTrendPhases } from "@/lib/research/trend-radar/phase-enrichment";

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

export async function generateTrendDigest(input: {
  digestId?: string;
  isGlobal: boolean;
  watchlistId?: string | null;
  seedKeywords?: string[];
  watchlistName?: string;
}): Promise<string> {
  const { weekStart, weekEnd } = weekBounds();

  let digestId = input.digestId;
  if (!digestId) {
    const digest = await prisma.trendRadarDigest.create({
      data: {
        weekStart,
        weekEnd,
        isGlobal: input.isGlobal,
        watchlistId: input.watchlistId ?? null,
        status: TrendRadarStatus.COLLECTING,
      },
    });
    digestId = digest.id;
  } else {
    await prisma.trendRadarDigest.update({
      where: { id: digestId },
      data: {
        status: TrendRadarStatus.COLLECTING,
        errorMessage: null,
      },
    });
    await prisma.trendRadarItem.deleteMany({ where: { digestId } });
  }

  try {
    const collected = await collectTrendSources(input.seedKeywords ?? []);

    await prisma.trendRadarDigest.update({
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
      const prompt = buildTrendAnalysisPrompt({
        signals: collected.signals,
        watchlistName: input.watchlistName,
        seedKeywords: input.seedKeywords,
      });
      result = await generateResearchJson<TrendAnalysisResult>(prompt);
    }

    if (!result.items?.length) {
      const demo = generateDemoTrendItems();
      result.items = demo;
    }

    const finalizedItems =
      collected.signals.length >= 3
        ? enrichTrendPhases(result.items, collected.signals)
        : result.items;

    await prisma.trendRadarItem.createMany({
      data: finalizedItems.map((item) => ({
        digestId: digestId!,
        name: String(item.name).slice(0, 200),
        dimension: normalizeTrendDimension(item.dimension),
        phase: normalizeTrendPhase(item.phase),
        score: clampTrendScore(item.score),
        narrative: item.narrative ?? null,
        isGlobalPipeline: Boolean(item.isGlobalPipeline),
        sources: Array.isArray(item.sources) ? item.sources : [],
        relatedProducts: Array.isArray(item.relatedProducts)
          ? item.relatedProducts.map(String)
          : [],
      })),
    });

    await prisma.trendRadarDigest.update({
      where: { id: digestId },
      data: {
        status: TrendRadarStatus.READY,
        narrative: result.narrative,
        generatedAt: new Date(),
        weekStart,
        weekEnd,
      },
    });

    return digestId;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Generate digest gagal.";
    await prisma.trendRadarDigest.update({
      where: { id: digestId },
      data: { status: TrendRadarStatus.FAILED, errorMessage: message },
    });
    throw err;
  }
}
