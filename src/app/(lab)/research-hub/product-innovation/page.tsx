import { Lightbulb } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { ResearchHubModulePage } from "@/components/research-hub/research-hub-module-page";
import { parseScamperIdeas } from "@/lib/research/product-innovation/types";
import {
  ProductInnovationClient,
  type InnovationRow,
  type BaseConceptOption,
} from "./product-innovation-client";

export default async function ProductInnovationPage() {
  const [innovations, concepts] = await Promise.all([
    prisma.productInnovation.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.productConcept.findMany({
      where: { status: { not: "ARCHIVED" } },
      select: { id: true, title: true, category: true },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
  ]);

  const rows: InnovationRow[] = innovations.map((i) => {
    const ideas = parseScamperIdeas(i.ideas);
    return {
      id: i.id,
      title: i.title,
      baseProduct: i.baseProduct,
      category: i.category,
      status: i.status,
      ideaCount: ideas.length,
      promotedCount: ideas.filter((idea) => idea.promotedConceptId).length,
      createdAt: i.createdAt.toISOString(),
    };
  });

  const baseConcepts: BaseConceptOption[] = concepts.map((c) => ({
    id: c.id,
    title: c.title,
    category: c.category,
  }));

  return (
    <ResearchHubModulePage
      icon={Lightbulb}
      title="Product Innovation — SCAMPER"
      description="Hasilkan alternatif inovasi produk dengan metode SCAMPER, berbasis evidence riset. Promosikan ide terbaik menjadi konsep di Concept Lab."
    >
      <ProductInnovationClient innovations={rows} baseConcepts={baseConcepts} />
    </ResearchHubModulePage>
  );
}
