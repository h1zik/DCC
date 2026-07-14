import { Package } from "lucide-react";
import { BrandHubListPage } from "@/components/brand-hub/brand-hub-list-page";
import { listCompetitorProductCategoriesForBrandHub } from "@/lib/brand-research/research-hub-readers";
import { ensureBrandHubPage } from "../../layout";
import {
  BrandCompetitorProductTrackerClient,
  type BrandCompetitorProductCategoryCard,
} from "./brand-competitor-product-tracker-client";

export default async function BrandCompetitorProductTrackerPage() {
  await ensureBrandHubPage();

  const categories = await listCompetitorProductCategoriesForBrandHub();

  const cards: BrandCompetitorProductCategoryCard[] = categories.map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description,
    isActive: c.isActive,
    productCount: c._count.tracks,
    unreadAlerts: c._count.alerts,
    updatedAt: c.updatedAt.toISOString(),
  }));

  return (
    <BrandHubListPage
      icon={Package}
      eyebrow="Market Intelligence"
      title="Competitor Products"
      subtitle="Produk kompetitor individual dari Research Hub — benchmark harga, rating, dan harvest visual."
    >
      <BrandCompetitorProductTrackerClient categories={cards} />
    </BrandHubListPage>
  );
}
