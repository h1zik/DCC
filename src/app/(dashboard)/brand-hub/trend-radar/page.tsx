import { Radar } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHero } from "@/components/page-hero";
import { ensureBrandHubPage } from "../layout";
import { isTikTokTrendsConfigured } from "@/lib/research/trend-radar/tiktok-trends";
import { getDefaultTrendSourceConfig } from "@/lib/research/trend-radar/trend-source-config";
import {
  BrandTrendRadarClient,
  type BrandTrendRadarPageData,
} from "./brand-trend-radar-client";

export default async function BrandTrendRadarPage() {
  await ensureBrandHubPage();

  const [latestGlobal, digests] = await Promise.all([
    prisma.brandTrendDigest.findFirst({
      where: { isGlobal: true, status: "READY" },
      orderBy: { generatedAt: "desc" },
      include: { items: true },
    }),
    prisma.brandTrendDigest.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        ownerBrand: { select: { name: true } },
        _count: { select: { items: true } },
      },
    }),
  ]);

  const pageData: BrandTrendRadarPageData = {
    latestGlobal: latestGlobal
      ? {
          id: latestGlobal.id,
          narrative: latestGlobal.narrative,
          generatedAt: latestGlobal.generatedAt?.toISOString() ?? null,
          status: latestGlobal.status,
          items: latestGlobal.items.map((i) => ({
            id: i.id,
            name: i.name,
            phase: i.phase,
            dimension: i.dimension,
            isGlobalPipeline: i.isGlobalPipeline,
          })),
        }
      : null,
    digests: digests.map((d) => ({
      id: d.id,
      weekStart: d.weekStart.toISOString(),
      weekEnd: d.weekEnd.toISOString(),
      status: d.status,
      isGlobal: d.isGlobal,
      brandName: d.isGlobal ? null : (d.ownerBrand?.name ?? null),
      itemCount: d._count.items,
      generatedAt: d.generatedAt?.toISOString() ?? null,
    })),
    globalSourceConfig: getDefaultTrendSourceConfig(),
    tiktokConfigured: isTikTokTrendsConfigured(),
  };

  return (
    <div className="flex w-full flex-col gap-6 pb-6">
      <PageHero
        icon={Radar}
        title="Trend Radar"
        subtitle="Deteksi tren konsumen, kategori emerging & design/visual trend (early signal)."
      />
      <BrandTrendRadarClient data={pageData} />
    </div>
  );
}
