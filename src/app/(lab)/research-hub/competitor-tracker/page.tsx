import { Target } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { resumeStuckResearchJobs } from "@/lib/research/run-apify-job";
import { ResearchHubModulePage } from "@/components/research-hub/research-hub-module-page";
import {
  CompetitorTrackerClient,
  type CompetitorCard,
} from "./competitor-tracker-client";

export default async function CompetitorTrackerPage() {
  await resumeStuckResearchJobs();

  const competitors = await prisma.researchCompetitor.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      skus: { select: { rating: true } },
      _count: { select: { skus: true, alerts: { where: { isRead: false } } } },
    },
  });

  const cards: CompetitorCard[] = competitors.map((c) => {
    const ratings = c.skus
      .map((s) => s.rating)
      .filter((r): r is number => r != null);
    const avgRating =
      ratings.length > 0
        ? ratings.reduce((a, b) => a + b, 0) / ratings.length
        : null;

    return {
      id: c.id,
      name: c.name,
      brand: c.brand,
      category: c.category,
      marketplace: c.marketplace,
      shopUrl: c.shopUrl,
      isActive: c.isActive,
      skuCount: c._count.skus,
      avgRating,
      unreadAlerts: c._count.alerts,
    };
  });

  return (
    <ResearchHubModulePage
      icon={Target}
      title="Competitor Tracker — Shops"
      description="Pantau seluruh katalog toko kompetitor: harga, SKU baru, rating, dan promo — update otomatis harian."
    >
      <CompetitorTrackerClient competitors={cards} />
    </ResearchHubModulePage>
  );
}
