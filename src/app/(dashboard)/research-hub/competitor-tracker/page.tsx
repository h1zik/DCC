import { Target } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { resumeStuckResearchJobs } from "@/lib/research/run-apify-job";
import { PageHero } from "@/components/page-hero";
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
    <div className="flex w-full flex-col gap-6 pb-6">
      <PageHero
        icon={Target}
        title="Competitor Tracker"
        subtitle="Pantau harga, SKU baru, rating, dan promo kompetitor — update otomatis harian."
      />
      <CompetitorTrackerClient competitors={cards} />
    </div>
  );
}
