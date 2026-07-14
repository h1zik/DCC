import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { LabPageShell } from "@/components/lab/lab-primitives";
import { parseRiskFactors } from "@/lib/research/concept-lab/types";
import {
  ConceptDetailClient,
  type ConceptDetailData,
} from "./concept-detail-client";
import { parseResearchAiMetaClient } from "@/lib/research/research-module-models";

export default async function ConceptDetailPage({
  params,
}: {
  params: Promise<{ conceptId: string }>;
}) {
  const { conceptId } = await params;

  const concept = await prisma.productConcept.findUnique({
    where: { id: conceptId },
  });
  if (!concept) notFound();

  const [rooms, otherConcepts] = await Promise.all([
    prisma.room.findMany({
      select: { id: true, name: true, brandId: true },
      orderBy: { name: "asc" },
    }),
    prisma.productConcept.findMany({
      where: { id: { not: conceptId }, status: { not: "ARCHIVED" } },
      select: { id: true, title: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  const conceptData =
    concept.conceptData && typeof concept.conceptData === "object"
      ? (concept.conceptData as ConceptDetailData["conceptData"])
      : {
          nameOptions: [],
          positioningStatement: "",
          heroIngredients: [],
          textureFormat: "",
          keyClaims: [],
          packagingDirection: "",
          estimatedCogsRange: { min: 0, max: 0 },
          competitorComparison: "",
          whyItWillWin: "",
        };

  const validationScores =
    concept.validationScores && typeof concept.validationScores === "object"
      ? (concept.validationScores as ConceptDetailData["validationScores"])
      : {
          marketDemand: 0,
          differentiation: 0,
          pricingFit: 0,
          overall: 0,
          risks: [],
          aiSummary: "",
        };

  const data: ConceptDetailData = {
    id: concept.id,
    title: concept.title,
    category: concept.category,
    targetMarket: concept.targetMarket,
    status: concept.status,
    conceptData,
    validationScores,
    riskFactors: parseRiskFactors(concept.riskFactors),
    uspGapAnalysisId: concept.uspGapAnalysisId,
    rooms,
    otherConcepts,
    aiMeta: parseResearchAiMetaClient(concept.aiMeta),
  };

  return (
    <LabPageShell>
      <ConceptDetailClient data={data} />
    </LabPageShell>
  );
}
