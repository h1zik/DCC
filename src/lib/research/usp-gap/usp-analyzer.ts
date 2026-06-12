import "server-only";

import { UspGapStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateResearchJson } from "@/lib/research/gemini-client";
import {
  gatherUspContext,
  type ContextModules,
} from "@/lib/research/usp-gap/gather-context";
import { normalizePositioningMap } from "@/lib/research/usp-gap/positioning-chart";
import { buildUspGapAnalysisPrompt } from "@/lib/research/usp-gap/prompts/usp-gap-analysis";

type AnalysisResult = {
  gapMatrix: {
    claim: string;
    competitors: string[];
    gapScore: number;
    opportunity: string;
  }[];
  claimAnalysis: {
    overused: string[];
    underserved: string[];
  };
  positioningMap: {
    axisX: string;
    axisY: string;
    points: { name: string; brand: string; x: number; y: number }[];
  };
  uspCandidates: {
    usp: string;
    rtb: string;
    differentiationScore: number;
    risks: string[];
  }[];
  differentiationScore: number;
  aiSummary: string;
};

function parseContextModules(raw: unknown): ContextModules {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  return {
    reviewIntel: !!o.reviewIntel,
    competitor: !!o.competitor,
    trendRadar: !!o.trendRadar,
    keywordIntel: !!o.keywordIntel,
    socialListening: !!o.socialListening,
  };
}

export async function analyzeUspGap(analysisId: string): Promise<void> {
  const analysis = await prisma.uspGapAnalysis.findUnique({
    where: { id: analysisId },
  });
  if (!analysis) throw new Error("Analisis USP tidak ditemukan.");

  const contextModules = parseContextModules(analysis.contextModules);

  await prisma.uspGapAnalysis.update({
    where: { id: analysisId },
    data: { status: UspGapStatus.GATHERING, errorMessage: null },
  });

  try {
    const context = await gatherUspContext({
      category: analysis.category,
      contextModules,
    });

    await prisma.uspGapAnalysis.update({
      where: { id: analysisId },
      data: { status: UspGapStatus.ANALYZING },
    });

    const prompt = buildUspGapAnalysisPrompt(context);
    const result = await generateResearchJson<AnalysisResult>(prompt);
    const positioningMap = normalizePositioningMap(result.positioningMap);

    await prisma.$transaction([
      prisma.uspGapResult.upsert({
        where: { analysisId },
        create: {
          analysisId,
          gapMatrix: result.gapMatrix ?? [],
          claimAnalysis: result.claimAnalysis ?? {},
          positioningMap,
          uspCandidates: result.uspCandidates ?? [],
          differentiationScore: result.differentiationScore ?? null,
          aiSummary: result.aiSummary ?? null,
        },
        update: {
          gapMatrix: result.gapMatrix ?? [],
          claimAnalysis: result.claimAnalysis ?? {},
          positioningMap,
          uspCandidates: result.uspCandidates ?? [],
          differentiationScore: result.differentiationScore ?? null,
          aiSummary: result.aiSummary ?? null,
        },
      }),
      prisma.uspGapAnalysis.update({
        where: { id: analysisId },
        data: { status: UspGapStatus.READY },
      }),
    ]);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Analisis gagal";
    await prisma.uspGapAnalysis.update({
      where: { id: analysisId },
      data: { status: UspGapStatus.FAILED, errorMessage: message },
    });
    throw err;
  }
}
