import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { LabPageShell } from "@/components/lab/lab-primitives";
import {
  ProductDiscoveryDetailClient,
  type ProductDiscoveryDetailData,
} from "./product-discovery-detail-client";
import { productDiscoveryProvenance } from "@/lib/research/resolve-scrape-provenance";
import { mapDiscoveryProductToRow } from "@/lib/research/shop-product-mappers";
import { parseResearchAiMetaClient } from "@/lib/research/research-module-models";

export default async function ProductDiscoveryDetailPage({
  params,
}: {
  params: Promise<{ queryId: string }>;
}) {
  const { queryId } = await params;

  const query = await prisma.productDiscoveryQuery.findUnique({
    where: { id: queryId },
    include: {
      products: { orderBy: [{ historicalSold: "desc" }, { soldCount: "desc" }, { rating: "desc" }] },
    },
  });

  if (!query) notFound();

  const shopCount = new Set(
    query.products.map((p) => p.shopName).filter(Boolean),
  ).size;

  const data: ProductDiscoveryDetailData = {
    id: query.id,
    keyword: query.keyword,
    marketplaces: query.marketplaces,
    productLimit: query.productLimit,
    status: query.status,
    productCount: query.productCount,
    shopCount,
    insights: query.aiInsights ?? null,
    actionPlan: query.aiActionPlan ?? null,
    aiMeta: parseResearchAiMetaClient(query.aiMeta),
    dataProvenance: productDiscoveryProvenance({
      marketplaces: query.marketplaces,
      scrapeState: query.scrapeState,
      errorMessage: query.errorMessage,
      dataProvenance: query.dataProvenance,
    }),
    products: query.products.map((p) => mapDiscoveryProductToRow(p)),
  };

  return (
    <LabPageShell>
      <ProductDiscoveryDetailClient data={data} />
    </LabPageShell>
  );
}
