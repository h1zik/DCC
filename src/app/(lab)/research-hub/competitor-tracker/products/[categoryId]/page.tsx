import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  CompetitorProductCategoryClient,
  type CompetitorProductCategoryDetail,
} from "./competitor-product-category-client";

export default async function CompetitorProductCategoryPage({
  params,
}: {
  params: Promise<{ categoryId: string }>;
}) {
  const { categoryId } = await params;

  const category = await prisma.competitorProductCategory.findUnique({
    where: { id: categoryId },
    include: {
      tracks: { orderBy: { updatedAt: "desc" } },
      alerts: { orderBy: { createdAt: "desc" }, take: 30 },
    },
  });

  if (!category) notFound();

  const detail: CompetitorProductCategoryDetail = {
    id: category.id,
    name: category.name,
    description: category.description,
    tracks: category.tracks.map((t) => ({
      id: t.id,
      name: t.name,
      brand: t.brand,
      productUrl: t.productUrl,
      marketplace: t.marketplace,
      imageUrl: t.imageUrl,
      shopName: t.shopName,
      currentPrice: t.currentPrice,
      rating: t.rating,
      reviewCount: t.reviewCount,
      hasPromo: t.hasPromo,
      promoText: t.promoText,
      scrapeError: t.scrapeError,
      lastScrapedAt: t.lastScrapedAt?.toISOString() ?? null,
    })),
    alerts: category.alerts.map((a) => ({
      id: a.id,
      type: a.type,
      message: a.message,
      severity: a.severity,
      isRead: a.isRead,
      createdAt: a.createdAt.toISOString(),
    })),
  };

  return <CompetitorProductCategoryClient category={detail} />;
}
