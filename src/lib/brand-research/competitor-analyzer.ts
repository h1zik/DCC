import "server-only";

import { prisma } from "@/lib/prisma";
import { generateResearchJson } from "@/lib/research/gemini-client";
import {
  buildResearchAiStep,
  researchAiMetaFromSteps,
} from "@/lib/research/llm";
import { coerceActionPlan } from "@/lib/research/prescriptive/parse";
import { syncModuleRecommendations } from "@/lib/research/prescriptive/sync";
import { buildActionPlanInstruction } from "@/lib/research/prescriptive/prompt";
import { buildCompetitorInsights } from "@/lib/research/competitor-insights";
import type { ActionPlan } from "@/lib/research/prescriptive/types";

export type CompetitorExtraMetrics = {
  /** Rata-rata kedalaman diskon (% turun dari harga tertinggi historis) pada SKU promo. */
  discountDepthPct: number | null;
  /** Pangsa SKU kategori (review-weighted) vs kompetitor lain di kategori sama. */
  shareOfCategoryPct: number | null;
  promoSkuCount: number;
};

export async function computeBrandCompetitorExtraMetrics(
  competitorId: string,
  category: string,
): Promise<CompetitorExtraMetrics> {
  const [skus, snapshots, categoryAgg, selfReviews] = await Promise.all([
    prisma.brandCompetitorSku.findMany({ where: { competitorId } }),
    prisma.brandCompetitorSnapshot.findMany({
      where: { competitorId },
      select: { skuId: true, price: true, hasPromo: true },
    }),
    prisma.brandCompetitorSku.aggregate({
      where: { competitor: { category, isActive: true } },
      _sum: { reviewCount: true },
    }),
    prisma.brandCompetitorSku.aggregate({
      where: { competitorId },
      _sum: { reviewCount: true },
    }),
  ]);

  // Discount depth: per SKU, currentPrice vs max historical snapshot price.
  const maxBySku = new Map<string, number>();
  const promoSkuIds = new Set<string>();
  for (const s of snapshots) {
    if (s.skuId && typeof s.price === "number" && s.price > 0) {
      maxBySku.set(s.skuId, Math.max(maxBySku.get(s.skuId) ?? 0, s.price));
    }
    if (s.skuId && s.hasPromo) promoSkuIds.add(s.skuId);
  }
  const discounts: number[] = [];
  for (const sku of skus) {
    const peak = maxBySku.get(sku.id);
    if (peak && sku.currentPrice && sku.currentPrice < peak) {
      discounts.push(((peak - sku.currentPrice) / peak) * 100);
    }
  }
  const promoSkuCount = promoSkuIds.size;
  const discountDepthPct =
    discounts.length > 0
      ? discounts.reduce((a, b) => a + b, 0) / discounts.length
      : null;

  const categoryReviews = categoryAgg._sum.reviewCount ?? 0;
  const ownReviews = selfReviews._sum.reviewCount ?? 0;
  const shareOfCategoryPct =
    categoryReviews > 0 ? (ownReviews / categoryReviews) * 100 : null;

  return { discountDepthPct, shareOfCategoryPct, promoSkuCount };
}

export async function analyzeBrandCompetitor(competitorId: string): Promise<void> {
  const competitor = await prisma.brandCompetitor.findUnique({
    where: { id: competitorId },
    include: {
      skus: { orderBy: { reviewCount: "desc" }, take: 30 },
      snapshots: {
        orderBy: { capturedAt: "desc" },
        take: 200,
        select: { skuId: true, price: true, capturedAt: true, hasPromo: true },
      },
      alerts: {
        where: { isRead: false },
        orderBy: { createdAt: "desc" },
        take: 10,
      },
    },
  });
  if (!competitor || competitor.skus.length === 0) return;

  const promoBySku = new Set<string>();
  for (const s of competitor.snapshots) {
    if (s.skuId && s.hasPromo) promoBySku.add(s.skuId);
  }

  const base = buildCompetitorInsights(
    competitor.skus.map((s) => ({
      id: s.id,
      name: s.name,
      currentPrice: s.currentPrice,
      rating: s.rating,
      reviewCount: s.reviewCount,
      hasPromo: promoBySku.has(s.id),
    })),
    competitor.snapshots.map((s) => ({
      skuId: s.skuId,
      price: s.price,
      capturedAt: s.capturedAt,
    })),
  );

  const extra = await computeBrandCompetitorExtraMetrics(
    competitorId,
    competitor.category,
  );

  const promptInput = {
    competitor: `${competitor.name} (${competitor.brand})`,
    category: competitor.category,
    skuCount: base.skuCount,
    priceRange: { min: base.minPrice, max: base.maxPrice, avg: base.avgPrice },
    avgRating: base.avgRating,
    promoPct: base.promoPct,
    discountDepthPct: extra.discountDepthPct,
    shareOfCategoryPct: extra.shareOfCategoryPct,
    heroProduct: base.topByReviews,
    openAlerts: competitor.alerts.map((a) => a.message),
  };

  let summary: string | null = null;
  let actionPlan: ActionPlan | null = null;
  try {
    const result = await generateResearchJson<{
      summary?: string;
      actionPlan?: unknown;
    }>(
      `Kamu adalah strateg kompetitif e-commerce kecantikan Indonesia.
Analisis kompetitor berikut dan buat "response playbook" — langkah balasan konkret.

Data kompetitor:
${JSON.stringify(promptInput, null, 2)}

${
  competitor.alerts.length > 0
    ? `Ada ${competitor.alerts.length} alert aktif (perubahan harga/promo/SKU baru). Sertakan minimal satu rekomendasi "counter-move" untuk meresponsnya.`
    : ""
}

1. "summary": 2-3 kalimat membaca strategi kompetitor (harga, promo, share, hero product).

${buildActionPlanInstruction(["PRICING", "MARKETING", "BRAND", "FINANCE"])}

Balas HANYA JSON valid:
{
  "summary": "string",
  "actionPlan": { "headline": "string", "recommendations": [ /* skema di atas */ ] }
}`,
    );
    summary = result.summary?.trim() || null;
    actionPlan = coerceActionPlan(result.actionPlan, `competitor-${competitorId}`);
  } catch (err) {
    console.error("[competitor-analyzer] gagal", err);
  }

  await prisma.brandCompetitor.update({
    where: { id: competitorId },
    data: {
      aiInsights: {
        summary,
        discountDepthPct: extra.discountDepthPct,
        shareOfCategoryPct: extra.shareOfCategoryPct,
        promoSkuCount: extra.promoSkuCount,
        actionPlan: actionPlan ?? null,
        generatedAt: new Date().toISOString(),
      } as object,
      aiMeta: researchAiMetaFromSteps([
        buildResearchAiStep("Insight kompetitor", "flash"),
      ]) as object,
    },
  });

  await syncModuleRecommendations({
    module: "brand-competitor-tracker",
    sourceId: competitorId,
    sourceLabel: `${competitor.brand} · ${competitor.name}`,
    href: `/brand-hub/competitor-tracker/${competitorId}`,
    plan: actionPlan,
  });
}
