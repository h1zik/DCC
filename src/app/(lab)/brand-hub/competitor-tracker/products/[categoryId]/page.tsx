import { notFound } from "next/navigation";
import { getCompetitorProductCategoryForBrandHub } from "@/lib/brand-research/research-hub-readers";
import { ensureBrandHubPage } from "../../../layout";
import {
  BrandCompetitorProductCategoryClient,
  type BrandCompetitorProductCategoryDetail,
} from "./brand-competitor-product-category-client";

export default async function BrandCompetitorProductCategoryPage({
  params,
}: {
  params: Promise<{ categoryId: string }>;
}) {
  await ensureBrandHubPage();
  const { categoryId } = await params;

  const category = await getCompetitorProductCategoryForBrandHub(categoryId);
  if (!category) notFound();

  const detail: BrandCompetitorProductCategoryDetail = {
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

  return <BrandCompetitorProductCategoryClient category={detail} />;
}
