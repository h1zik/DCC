import { FlaskConical } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { ResearchHubModulePage } from "@/components/research-hub/research-hub-module-page";
import {
  ConceptLabClient,
  type ConceptRow,
} from "./concept-lab-client";

export default async function ConceptLabPage() {
  const concepts = await prisma.productConcept.findMany({
    orderBy: { createdAt: "desc" },
  });

  const rows: ConceptRow[] = concepts.map((c) => {
    const scores =
      c.validationScores && typeof c.validationScores === "object"
        ? (c.validationScores as { overall?: number; decision?: string })
        : {};
    return {
      id: c.id,
      title: c.title,
      category: c.category,
      mode: c.mode,
      status: c.status,
      overallScore:
        typeof scores.overall === "number" ? scores.overall : null,
      decision:
        typeof scores.decision === "string" ? scores.decision : null,
      uspGapAnalysisId: c.uspGapAnalysisId,
      createdAt: c.createdAt.toISOString(),
    };
  });

  return (
    <ResearchHubModulePage
      icon={FlaskConical}
      title="Product Concept Lab"
      description="Bangun dan validasi konsep produk siap brief ke R&D — manual atau AI generate."
    >
      <ConceptLabClient concepts={rows} />
    </ResearchHubModulePage>
  );
}
