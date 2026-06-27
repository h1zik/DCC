import { LineChart } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { SeoModulePage } from "@/components/seo/seo-module-page";
import {
  RankTrackerClient,
  type RankProjectRow,
} from "./rank-tracker-client";

export default async function SeoRankTrackerPage() {
  const projects = await prisma.seoRankProject.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { keywords: true } } },
  });

  const rows: RankProjectRow[] = projects.map((p) => ({
    id: p.id,
    name: p.name,
    domain: p.domain,
    device: p.device,
    isActive: p.isActive,
    keywordCount: p._count.keywords,
    createdAt: p.createdAt.toISOString(),
  }));

  return (
    <SeoModulePage
      icon={LineChart}
      title="SERP Rank Tracker"
      description="Pantau posisi keyword di Google Indonesia secara terjadwal (cron harian). Lihat tren posisi & SERP feature, dan dapat web push saat ada perubahan signifikan."
    >
      <RankTrackerClient projects={rows} />
    </SeoModulePage>
  );
}
