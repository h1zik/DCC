import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { LabPageShell } from "@/components/lab/lab-primitives";
import { parseScamperIdeas } from "@/lib/research/product-innovation/types";
import { parseRiskFactors } from "@/lib/research/concept-lab/types";
import { parseResearchAiMetaClient } from "@/lib/research/research-module-models";
import {
  InnovationDetailClient,
  type InnovationDetailData,
} from "./innovation-detail-client";

export default async function InnovationDetailPage({
  params,
}: {
  params: Promise<{ innovationId: string }>;
}) {
  const { innovationId } = await params;

  const innovation = await prisma.productInnovation.findUnique({
    where: { id: innovationId },
  });
  if (!innovation) notFound();

  const snapshot =
    innovation.evidenceSnapshot &&
    typeof innovation.evidenceSnapshot === "object"
      ? (innovation.evidenceSnapshot as { aiSummary?: string | null })
      : {};

  const data: InnovationDetailData = {
    id: innovation.id,
    title: innovation.title,
    baseProduct: innovation.baseProduct,
    category: innovation.category,
    targetMarket: innovation.targetMarket,
    status: innovation.status,
    ideas: parseScamperIdeas(innovation.ideas),
    riskFactors: parseRiskFactors(innovation.riskFactors),
    aiSummary: typeof snapshot.aiSummary === "string" ? snapshot.aiSummary : null,
    errorMessage: innovation.errorMessage,
    aiMeta: parseResearchAiMetaClient(innovation.aiMeta),
  };

  return (
    <LabPageShell>
      <InnovationDetailClient data={data} />
    </LabPageShell>
  );
}
