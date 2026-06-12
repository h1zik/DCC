import { FlaskConical } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHero } from "@/components/page-hero";
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
        ? (c.validationScores as { overall?: number })
        : {};
    return {
      id: c.id,
      title: c.title,
      category: c.category,
      mode: c.mode,
      status: c.status,
      overallScore:
        typeof scores.overall === "number" ? scores.overall : null,
      createdAt: c.createdAt.toISOString(),
    };
  });

  return (
    <div className="flex w-full flex-col gap-6 pb-6">
      <PageHero
        icon={FlaskConical}
        title="Product Concept Lab"
        subtitle="Bangun dan validasi konsep produk siap brief ke R&D — manual atau AI generate."
      />
      <ConceptLabClient concepts={rows} />
    </div>
  );
}
