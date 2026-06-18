import { Target } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHero } from "@/components/page-hero";
import { resumeStuckBrandJobs } from "@/lib/brand-research/run-apify-job";
import { ensureBrandHubPage } from "../layout";
import {
  BrandCompetitorTrackerClient,
  type CompetitorCard,
} from "./brand-competitor-tracker-client";

export default async function BrandCompetitorTrackerPage() {
  const session = await ensureBrandHubPage();
  await resumeStuckBrandJobs();

  const competitors = await prisma.brandCompetitor.findMany({
    where: { createdById: session.user.id },
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
        subtitle="Pantau harga, positioning, dan perubahan portfolio kompetitor secara real-time."
      />
      <BrandCompetitorTrackerClient competitors={cards} />
    </div>
  );
}
