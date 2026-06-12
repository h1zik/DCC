import { Radar } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHero } from "@/components/page-hero";
import { TrendRadarClient, type TrendRadarPageData } from "./trend-radar-client";

export default async function TrendRadarPage() {
  const [latestGlobal, digests, watchlists] = await Promise.all([
    prisma.trendRadarDigest.findFirst({
      where: { isGlobal: true, status: "READY" },
      orderBy: { generatedAt: "desc" },
      include: { items: true },
    }),
    prisma.trendRadarDigest.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        watchlist: { select: { name: true } },
        _count: { select: { items: true } },
      },
    }),
    prisma.trendWatchlist.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        digests: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { id: true, status: true, generatedAt: true },
        },
      },
    }),
  ]);

  const pageData: TrendRadarPageData = {
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
      watchlistName: d.watchlist?.name ?? null,
      itemCount: d._count.items,
      generatedAt: d.generatedAt?.toISOString() ?? null,
    })),
    watchlists: watchlists.map((w) => ({
      id: w.id,
      name: w.name,
      keywords: w.keywords,
      isActive: w.isActive,
      latestDigest: w.digests[0]
        ? {
            id: w.digests[0].id,
            status: w.digests[0].status,
            generatedAt: w.digests[0].generatedAt?.toISOString() ?? null,
          }
        : null,
    })),
  };

  return (
    <div className="flex w-full flex-col gap-6 pb-6">
      <PageHero
        icon={Radar}
        title="Trend Radar"
        subtitle="Deteksi tren bahan, klaim, dan kategori — digest mingguan + watchlist kustom."
      />
      <TrendRadarClient data={pageData} />
    </div>
  );
}
