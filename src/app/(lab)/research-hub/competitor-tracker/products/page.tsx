import { Package } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { ResearchHubModulePage } from "@/components/research-hub/research-hub-module-page";
import {
  CompetitorProductTrackerClient,
  type CompetitorProductCategoryCard,
} from "./competitor-product-tracker-client";

export default async function CompetitorProductTrackerPage() {
  const categories = await prisma.competitorProductCategory.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      _count: {
        select: {
          tracks: true,
          alerts: { where: { isRead: false } },
        },
      },
    },
  });

  const cards: CompetitorProductCategoryCard[] = categories.map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description,
    isActive: c.isActive,
    productCount: c._count.tracks,
    unreadAlerts: c._count.alerts,
    updatedAt: c.updatedAt.toISOString(),
  }));

  return (
    <ResearchHubModulePage
      icon={Package}
      title="Competitor Tracker — Products"
      description="Kelompokkan produk kompetitor per kategori (mis. Deodorant) dan pantau URL produk spesifik — harga, rating, promo."
    >
      <CompetitorProductTrackerClient categories={cards} />
    </ResearchHubModulePage>
  );
}
