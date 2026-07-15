import { Target } from "lucide-react";
import { BrandHubListPage } from "@/components/brand-hub/brand-hub-list-page";
import { listResearchCompetitorsForBrandHub } from "@/lib/brand-research/research-hub-readers";
import { ensureBrandHubPage } from "../layout";
import {
  BrandCompetitorTrackerClient,
  type CompetitorCard,
} from "./brand-competitor-tracker-client";

export default async function BrandCompetitorTrackerPage() {
  await ensureBrandHubPage();

  const competitors = await listResearchCompetitorsForBrandHub();

  const cards: CompetitorCard[] = competitors.map((c) => {
    const ratings = c.skus
      .map((s) => s.rating)
      .filter((r): r is number => r != null);
    const avgRating =
      ratings.length > 0
        ? ratings.reduce((a, b) => a + b, 0) / ratings.length
        : null;
    const imageSkuCount = c.skus.filter((s) => s.imageUrl).length;

    return {
      id: c.id,
      name: c.name,
      brand: c.brand,
      category: c.category,
      marketplace: c.marketplace,
      shopUrl: c.shopUrl,
      isActive: c.isActive,
      skuCount: c._count.skus,
      imageSkuCount,
      avgRating,
      unreadAlerts: c._count.alerts,
    };
  });

  return (
    <BrandHubListPage
      icon={Target}
      eyebrow="Market Intelligence"
      title="Competitor Tracker"
      subtitle="Data kompetitor dari Research Hub (Market Analyst). Lihat detail dan harvest visual ke library."
    >
      <BrandCompetitorTrackerClient competitors={cards} />
    </BrandHubListPage>
  );
}
