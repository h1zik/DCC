import "server-only";

import { UspGapStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateResearchJson } from "@/lib/research/gemini-client";
import {
  buildResearchAiStep,
  researchAiMetaFromSteps,
} from "@/lib/research/llm";
import {
  gatherBrandUspContext,
} from "@/lib/brand-research/gather-context";
import { parseContextModules } from "@/lib/brand-research/list-context-sources";
import { normalizePositioningMap } from "@/lib/research/usp-gap/positioning-chart";
import { buildUspGapAnalysisPrompt } from "@/lib/research/usp-gap/prompts/usp-gap-analysis";
import { coerceActionPlan } from "@/lib/research/prescriptive/parse";
import { syncModuleRecommendations } from "@/lib/research/prescriptive/sync";
import type { ActionPlan } from "@/lib/research/prescriptive/types";

type CategoryDecision = {
  verdict: "GO" | "WATCH" | "AVOID";
  confidence: number;
  reason: string;
};

type AnalysisResult = {
  gapMatrix: {
    claim: string;
    competitors: string[];
    gapScore: number;
    opportunity: string;
    recommendedAction?: string;
    priority?: "P0" | "P1" | "P2";
    evidenceRefs?: string[];
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
  categoryDecision?: CategoryDecision;
  actionPlan?: unknown;
  aiSummary: string;
};

const VALID_VERDICTS = new Set(["GO", "WATCH", "AVOID"]);

function normalizeCategoryDecision(raw: unknown): CategoryDecision | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const verdict = String(obj.verdict ?? "").toUpperCase();
  if (!VALID_VERDICTS.has(verdict)) return null;
  const confidence = Number(obj.confidence);
  return {
    verdict: verdict as CategoryDecision["verdict"],
    confidence: Number.isFinite(confidence)
      ? Math.min(1, Math.max(0, confidence))
      : 0.5,
    reason: typeof obj.reason === "string" ? obj.reason : "",
  };
}

function parseContextModulesFromAnalysis(raw: unknown) {
  return parseContextModules(raw);
}

export async function analyzeBrandUspGap(analysisId: string): Promise<void> {
  const analysis = await prisma.brandUspAnalysis.findUnique({
    where: { id: analysisId },
  });
  if (!analysis) throw new Error("Analisis USP tidak ditemukan.");

  const contextModules = parseContextModulesFromAnalysis(analysis.contextModules);

  await prisma.brandUspAnalysis.update({
    where: { id: analysisId },
    data: { status: UspGapStatus.GATHERING, errorMessage: null },
  });

  try {
    const { context, resolvedSources } = await gatherBrandUspContext({
      category: analysis.category,
      contextModules,
    });

    await prisma.brandUspAnalysis.update({
      where: { id: analysisId },
      data: {
        status: UspGapStatus.ANALYZING,
        contextModules: {
          ...contextModules,
          resolvedSources,
        },
      },
    });

    const prompt = buildUspGapAnalysisPrompt(context);
    const result = await generateResearchJson<AnalysisResult>(prompt, {
      tier: "pro",
    });
    const positioningMap = normalizePositioningMap(result.positioningMap);
    const categoryDecision = normalizeCategoryDecision(result.categoryDecision);
    const actionPlan: ActionPlan | null = coerceActionPlan(
      result.actionPlan,
      `usp-${analysisId}`,
    );

    const aiMeta = researchAiMetaFromSteps([
      buildResearchAiStep("Gap matrix & positioning", "pro"),
    ]);

    await prisma.$transaction([
      prisma.brandUspResult.upsert({
        where: { analysisId },
        create: {
          analysisId,
          gapMatrix: result.gapMatrix ?? [],
          claimAnalysis: result.claimAnalysis ?? {},
          positioningMap,
          uspCandidates: result.uspCandidates ?? [],
          differentiationScore: result.differentiationScore ?? null,
          aiSummary: result.aiSummary ?? null,
          categoryDecision: categoryDecision ?? undefined,
          aiActionPlan: actionPlan ?? undefined,
          aiMeta: aiMeta as object,
        },
        update: {
          gapMatrix: result.gapMatrix ?? [],
          claimAnalysis: result.claimAnalysis ?? {},
          positioningMap,
          uspCandidates: result.uspCandidates ?? [],
          differentiationScore: result.differentiationScore ?? null,
          aiSummary: result.aiSummary ?? null,
          categoryDecision: categoryDecision ?? undefined,
          aiActionPlan: actionPlan ?? undefined,
          aiMeta: aiMeta as object,
        },
      }),
      prisma.brandUspAnalysis.update({
        where: { id: analysisId },
        data: {
          status: UspGapStatus.READY,
          contextModules: {
            ...contextModules,
            resolvedSources,
          },
        },
      }),
    ]);

    await syncModuleRecommendations({
      module: "usp-gap",
      sourceId: analysisId,
      sourceLabel: `USP & Gap: ${analysis.category}`,
      href: `/brand-hub/usp-analyzer/${analysisId}`,
      plan: actionPlan,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Analisis gagal";
    await prisma.brandUspAnalysis.update({
      where: { id: analysisId },
      data: { status: UspGapStatus.FAILED, errorMessage: message },
    });
    throw err;
  }
}
