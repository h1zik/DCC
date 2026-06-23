import "server-only";

import { prisma } from "@/lib/prisma";

export type ProductDiscoveryEvidence = {
  sourceId: string;
  keyword: string;
  productCount: number;
  marketplaces: string[];
  summary: string | null;
  priceStats: {
    min?: number;
    max?: number;
    median?: number;
    avg?: number;
  } | null;
  promoSharePct: number | null;
  topSellers: { name: string; sold: number; price: number | null }[];
  brandBreakdown: { shopName: string; productCount: number; avgRating: number }[];
};

function pickInsights(
  raw: unknown,
): Omit<ProductDiscoveryEvidence, "sourceId" | "keyword" | "productCount" | "marketplaces"> {
  if (!raw || typeof raw !== "object") {
    return {
      summary: null,
      priceStats: null,
      promoSharePct: null,
      topSellers: [],
      brandBreakdown: [],
    };
  }

  const o = raw as Record<string, unknown>;
  const priceStats =
    o.priceStats && typeof o.priceStats === "object"
      ? (o.priceStats as ProductDiscoveryEvidence["priceStats"])
      : null;
  const velocity = o.velocity as {
    topSellers?: { name?: string; sold?: number; price?: number }[];
  } | undefined;
  const topSellers = Array.isArray(velocity?.topSellers)
    ? velocity!.topSellers
        .slice(0, 5)
        .map((s) => ({
          name: String(s.name ?? ""),
          sold: Number(s.sold ?? 0),
          price: typeof s.price === "number" ? s.price : null,
        }))
        .filter((s) => s.name)
    : [];
  const brandBreakdown = Array.isArray(o.brandBreakdown)
    ? (o.brandBreakdown as { shopName?: string; productCount?: number; avgRating?: number }[])
        .slice(0, 8)
        .map((b) => ({
          shopName: String(b.shopName ?? ""),
          productCount: Number(b.productCount ?? 0),
          avgRating: Number(b.avgRating ?? 0),
        }))
        .filter((b) => b.shopName)
    : [];

  return {
    summary: typeof o.summary === "string" ? o.summary : null,
    priceStats,
    promoSharePct: typeof o.promoShare === "number" ? o.promoShare : null,
    topSellers,
    brandBreakdown,
  };
}

export async function fetchProductDiscoveryEvidence(
  queryIds: string[],
): Promise<ProductDiscoveryEvidence[]> {
  if (queryIds.length === 0) return [];

  const queries = await prisma.productDiscoveryQuery.findMany({
    where: {
      id: { in: queryIds },
      status: "READY",
    },
    take: 10,
    select: {
      id: true,
      keyword: true,
      productCount: true,
      marketplaces: true,
      aiInsights: true,
    },
  });

  return queries.map((q) => ({
    sourceId: q.id,
    keyword: q.keyword,
    productCount: q.productCount,
    marketplaces: q.marketplaces,
    ...pickInsights(q.aiInsights),
  }));
}
