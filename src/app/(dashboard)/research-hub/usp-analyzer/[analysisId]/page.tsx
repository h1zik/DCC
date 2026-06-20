import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { parseStoredContextModules } from "@/lib/research/usp-gap/list-context-sources";
import { normalizePositioningMap } from "@/lib/research/usp-gap/positioning-chart";
import { ResearchHubPageShell } from "@/components/research-hub/research-hub-primitives";
import {
  UspDetailClient,
  type UspDetailData,
} from "./usp-detail-client";
import { parseResearchAiMetaClient } from "@/lib/research/research-module-models";

export default async function UspAnalyzerDetailPage({
  params,
}: {
  params: Promise<{ analysisId: string }>;
}) {
  const { analysisId } = await params;

  const analysis = await prisma.uspGapAnalysis.findUnique({
    where: { id: analysisId },
    include: { result: true },
  });

  if (!analysis) notFound();

  const rooms = await prisma.room.findMany({
    select: {
      id: true,
      name: true,
      brandId: true,
      brand: { select: { name: true } },
    },
    orderBy: { name: "asc" },
  });

  const gapMatrix = Array.isArray(analysis.result?.gapMatrix)
    ? (analysis.result.gapMatrix as UspDetailData["gapMatrix"])
    : [];
  const claimAnalysis =
    analysis.result?.claimAnalysis &&
    typeof analysis.result.claimAnalysis === "object"
      ? (analysis.result.claimAnalysis as UspDetailData["claimAnalysis"])
      : {};
  const positioningMap = normalizePositioningMap(
    analysis.result?.positioningMap as UspDetailData["positioningMap"] | null,
  );
  const uspCandidates = Array.isArray(analysis.result?.uspCandidates)
    ? (analysis.result.uspCandidates as UspDetailData["uspCandidates"])
    : [];

  const storedContext = parseStoredContextModules(analysis.contextModules);

  const data: UspDetailData = {
    id: analysis.id,
    analysisId: analysis.id,
    category: analysis.category,
    status: analysis.status,
    errorMessage: analysis.errorMessage,
    aiSummary: analysis.result?.aiSummary ?? null,
    differentiationScore: analysis.result?.differentiationScore ?? null,
    categoryDecision:
      (analysis.result?.categoryDecision as UspDetailData["categoryDecision"]) ??
      null,
    actionPlan: analysis.result?.aiActionPlan ?? null,
    aiMeta: parseResearchAiMetaClient(analysis.result?.aiMeta),
    gapMatrix,
    claimAnalysis,
    positioningMap,
    uspCandidates,
    resolvedSources: storedContext.resolvedSources ?? null,
    contextModules: storedContext,
    rooms: rooms.map((r) => ({
      id: r.id,
      name: r.name,
      brandId: r.brandId,
      brandName: r.brand?.name ?? null,
    })),
  };

  return (
    <ResearchHubPageShell>
      <UspDetailClient data={data} />
    </ResearchHubPageShell>
  );
}
