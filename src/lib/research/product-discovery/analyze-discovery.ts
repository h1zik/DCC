import "server-only";

import { prisma } from "@/lib/prisma";
import { generateResearchJson } from "@/lib/research/gemini-client";
import {
  buildResearchAiStep,
  researchAiMetaFromSteps,
} from "@/lib/research/llm";
import { coerceActionPlan } from "@/lib/research/prescriptive/parse";
import {
  corpusFromData,
  groundActionPlan,
} from "@/lib/research/usp-gap/evidence-grounding";
import { syncModuleRecommendations } from "@/lib/research/prescriptive/sync";
import { buildActionPlanInstruction } from "@/lib/research/prescriptive/prompt";
import { buildBrandGuardInstruction, dedupeBrandNames } from "@/lib/research/brand-guard";
import type { ActionPlan } from "@/lib/research/prescriptive/types";

export type PriceBand = {
  label: string;
  min: number;
  max: number;
  count: number;
  avgRating: number;
  avgSold: number;
};

export type BrandBreakdownRow = {
  shopName: string;
  productCount: number;
  avgRating: number;
  totalSold: number;
  marketplaces: string[];
};

export type DiscoveryInsights = {
  productCount: number;
  shopCount: number;
  brandBreakdown: BrandBreakdownRow[];
  priceStats: { min: number; max: number; avg: number; median: number } | null;
  priceBands: PriceBand[];
  velocity: {
    totalSold: number;
    avgSold: number;
    topSellers: { name: string; soldCount: number; price: number | null }[];
  };
  valueLeaders: {
    name: string;
    rating: number;
    price: number;
    valueScore: number;
  }[];
  promoShare: number;
  bubble: {
    name: string;
    price: number;
    rating: number;
    sold: number;
    marketplace: string;
  }[];
};

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!;
}

type DiscoveryProduct = {
  name: string;
  price: number | null;
  rating: number | null;
  reviewCount: number;
  soldCount: number | null;
  hasPromo: boolean;
  shopName: string | null;
  marketplace: string;
};

export function computeDiscoveryInsights(
  products: DiscoveryProduct[],
): DiscoveryInsights {
  const prices = products
    .map((p) => p.price)
    .filter((v): v is number => typeof v === "number" && v > 0);

  const priceStats =
    prices.length > 0
      ? {
          min: Math.min(...prices),
          max: Math.max(...prices),
          avg: prices.reduce((a, b) => a + b, 0) / prices.length,
          median: median(prices),
        }
      : null;

  const priceBands: PriceBand[] = [];
  if (priceStats && priceStats.max > priceStats.min) {
    const span = priceStats.max - priceStats.min;
    const step = span / 4;
    for (let i = 0; i < 4; i += 1) {
      const lo = priceStats.min + step * i;
      const hi = i === 3 ? priceStats.max : priceStats.min + step * (i + 1);
      const inBand = products.filter(
        (p) =>
          typeof p.price === "number" &&
          p.price >= lo &&
          (i === 3 ? p.price <= hi : p.price < hi),
      );
      const ratings = inBand
        .map((p) => p.rating)
        .filter((v): v is number => typeof v === "number");
      const solds = inBand
        .map((p) => p.soldCount)
        .filter((v): v is number => typeof v === "number");
      priceBands.push({
        label: `Rp${Math.round(lo / 1000)}k–${Math.round(hi / 1000)}k`,
        min: Math.round(lo),
        max: Math.round(hi),
        count: inBand.length,
        avgRating: ratings.length
          ? ratings.reduce((a, b) => a + b, 0) / ratings.length
          : 0,
        avgSold: solds.length
          ? solds.reduce((a, b) => a + b, 0) / solds.length
          : 0,
      });
    }
  }

  const solds = products
    .map((p) => p.soldCount)
    .filter((v): v is number => typeof v === "number");
  const totalSold = solds.reduce((a, b) => a + b, 0);
  const topSellers = [...products]
    .filter((p) => typeof p.soldCount === "number")
    .sort((a, b) => (b.soldCount ?? 0) - (a.soldCount ?? 0))
    .slice(0, 5)
    .map((p) => ({ name: p.name, soldCount: p.soldCount ?? 0, price: p.price }));

  const valueLeaders = products
    .filter(
      (p) =>
        typeof p.price === "number" &&
        p.price > 0 &&
        typeof p.rating === "number" &&
        p.rating > 0,
    )
    .map((p) => ({
      name: p.name,
      rating: p.rating as number,
      price: p.price as number,
      // value = rating weighted by sales velocity per price unit
      valueScore:
        ((p.rating as number) * Math.log10((p.soldCount ?? 0) + 10)) /
        ((p.price as number) / 1000),
    }))
    .sort((a, b) => b.valueScore - a.valueScore)
    .slice(0, 5);

  const promoCount = products.filter((p) => p.hasPromo).length;

  const bubble = products
    .filter((p) => typeof p.price === "number" && typeof p.rating === "number")
    .map((p) => ({
      name: p.name,
      price: p.price as number,
      rating: p.rating as number,
      sold: p.soldCount ?? 0,
      marketplace: p.marketplace,
    }));

  const shopCount = new Set(
    products.map((p) => p.shopName).filter(Boolean),
  ).size;

  const brandMap = new Map<
    string,
    {
      shopName: string;
      count: number;
      ratings: number[];
      sold: number;
      marketplaces: Set<string>;
    }
  >();
  for (const p of products) {
    if (!p.shopName?.trim()) continue;
    const key = p.shopName.trim().toLowerCase();
    const row = brandMap.get(key) ?? {
      shopName: p.shopName.trim(),
      count: 0,
      ratings: [],
      sold: 0,
      marketplaces: new Set<string>(),
    };
    row.count += 1;
    if (typeof p.rating === "number") row.ratings.push(p.rating);
    if (typeof p.soldCount === "number") row.sold += p.soldCount;
    row.marketplaces.add(p.marketplace);
    brandMap.set(key, row);
  }
  const brandBreakdown: BrandBreakdownRow[] = [...brandMap.values()]
    .map((b) => ({
      shopName: b.shopName,
      productCount: b.count,
      avgRating: b.ratings.length
        ? b.ratings.reduce((a, c) => a + c, 0) / b.ratings.length
        : 0,
      totalSold: b.sold,
      marketplaces: [...b.marketplaces],
    }))
    .sort((a, b) => b.productCount - a.productCount)
    .slice(0, 20);

  return {
    productCount: products.length,
    shopCount,
    brandBreakdown,
    priceStats,
    priceBands,
    velocity: {
      totalSold,
      avgSold: solds.length ? totalSold / solds.length : 0,
      topSellers,
    },
    valueLeaders,
    promoShare: products.length ? (promoCount / products.length) * 100 : 0,
    bubble,
  };
}

function buildDiscoveryPrompt(
  keyword: string,
  insights: DiscoveryInsights,
  forbiddenBrands: string[],
): string {
  const compact = {
    keyword,
    productCount: insights.productCount,
    shopCount: insights.shopCount,
    priceStats: insights.priceStats,
    priceBands: insights.priceBands,
    promoSharePct: Math.round(insights.promoShare),
    topSellers: insights.velocity.topSellers,
    valueLeaders: insights.valueLeaders.map((v) => ({
      name: v.name,
      rating: v.rating,
      price: v.price,
    })),
    brandBreakdown: insights.brandBreakdown.slice(0, 15),
  };

  return `Kamu adalah analis pasar e-commerce kecantikan Indonesia.
Analisis hasil pencarian produk kompetitor untuk keyword "${keyword}".

Data agregat:
${JSON.stringify(compact, null, 2)}

1. "summary": 2-3 kalimat insight pasar (price band terpadat, white space harga, dinamika promo, pemimpin velocity).

${buildBrandGuardInstruction({ forbiddenBrands })}

${buildActionPlanInstruction(["PRICING", "MARKETING", "RND", "FINANCE"], forbiddenBrands)}

Balas HANYA JSON valid:
{
  "summary": "string",
  "actionPlan": { "headline": "string", "recommendations": [ /* skema di atas */ ] }
}`;
}

export async function analyzeProductDiscovery(queryId: string): Promise<void> {
  const query = await prisma.productDiscoveryQuery.findUnique({
    where: { id: queryId },
    include: { products: true },
  });
  if (!query || query.products.length === 0) return;

  const insights = computeDiscoveryInsights(
    query.products.map((p) => ({
      name: p.name,
      price: p.price,
      rating: p.rating,
      reviewCount: p.reviewCount,
      soldCount: p.soldCount,
      hasPromo: p.hasPromo,
      shopName: p.shopName,
      marketplace: p.marketplace,
    })),
  );

  let summary: string | null = null;
  let actionPlan: ActionPlan | null = null;
  let actualModel: string | undefined;
  let aiError: string | undefined;
  const forbiddenBrands = dedupeBrandNames(
    insights.brandBreakdown.map((b) => b.shopName),
  );
  try {
    const result = await generateResearchJson<{
      summary?: string;
      actionPlan?: unknown;
    }>(buildDiscoveryPrompt(query.keyword, insights, forbiddenBrands), {
      onModelUsed: (m) => (actualModel = m),
    });
    summary = result.summary?.trim() || null;
    actionPlan = groundActionPlan(
      coerceActionPlan(result.actionPlan, `discovery-${queryId}`),
      corpusFromData({ keyword: query.keyword, insights }),
    );
  } catch (err) {
    console.error("[analyze-discovery] action plan gagal", err);
    aiError = err instanceof Error ? err.message : String(err);
  }

  const aiMeta = researchAiMetaFromSteps([
    buildResearchAiStep("Ringkasan pasar & rencana aksi", "flash", {
      actualModel,
      error: aiError,
    }),
  ]);

  await prisma.productDiscoveryQuery.update({
    where: { id: queryId },
    data: {
      aiInsights: { ...insights, summary, aiError: aiError ?? null } as object,
      aiActionPlan: actionPlan ?? undefined,
      aiMeta: aiMeta as object,
    },
  });

  await syncModuleRecommendations({
    module: "product-discovery",
    sourceId: queryId,
    sourceLabel: `Discovery: ${query.keyword}`,
    href: `/research-hub/product-discovery/${queryId}`,
    plan: actionPlan,
  });
}
