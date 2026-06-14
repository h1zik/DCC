import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  ProductDiscoveryDetailClient,
  type ProductDiscoveryDetailData,
} from "./product-discovery-detail-client";
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
      products: { orderBy: [{ soldCount: "desc" }, { rating: "desc" }] },
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
    errorMessage: query.errorMessage,
    shopCount,
    insights: query.aiInsights ?? null,
    actionPlan: query.aiActionPlan ?? null,
    aiMeta: parseResearchAiMetaClient(query.aiMeta),
    products: query.products.map((p) => ({
      id: p.id,
      name: p.name,
      shopName: p.shopName,
      marketplace: p.marketplace,
      price: p.price,
      rating: p.rating,
      reviewCount: p.reviewCount,
      soldCount: p.soldCount,
      hasPromo: p.hasPromo,
      promoText: p.promoText,
      productUrl: p.productUrl,
      categoryRank: p.categoryRank,
    })),
  };

  return (
    <div className="flex w-full flex-col gap-6 pb-6">
      <ProductDiscoveryDetailClient data={data} />
    </div>
  );
}
