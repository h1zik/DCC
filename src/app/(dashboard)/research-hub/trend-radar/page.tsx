import { Radar } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ResearchHubModulePage } from "@/components/research-hub/research-hub-module-page";
import { isTikTokTrendsConfigured } from "@/lib/research/trend-radar/tiktok-trends";
import {
  getDefaultTrendSourceConfig,
  parseTrendSourceConfigJson,
  resolveTrendSourceConfig,
} from "@/lib/research/trend-radar/trend-source-config";
import { TrendRadarClient, type TrendRadarPageData } from "./trend-radar-client";

import type { TrendSignalStats } from "@/lib/research/trend-radar/trend-signal-types";

function parseSignalStats(raw: unknown): TrendSignalStats | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as TrendSignalStats;
  if (typeof s.total !== "number") return null;
  return s;
}

export default async function TrendRadarPage() {
  const session = await auth();
  const userId = session?.user?.id;

  const [latestGlobal, globalInProgress, digests, watchlists, userSettings] =
    await Promise.all([
    prisma.trendRadarDigest.findFirst({
      where: { isGlobal: true, status: "READY" },
      orderBy: { generatedAt: "desc" },
      include: { items: true },
    }),
    prisma.trendRadarDigest.findFirst({
      where: {
        isGlobal: true,
        status: { in: ["COLLECTING", "ANALYZING"] },
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, status: true },
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
    userId
      ? prisma.trendRadarUserSettings.findUnique({ where: { userId } })
      : Promise.resolve(null),
  ]);

  const defaults = getDefaultTrendSourceConfig();
  const storedUserConfig = userSettings?.sourceConfig
    ? parseTrendSourceConfigJson(userSettings.sourceConfig)
    : null;
  const globalSourceConfig = resolveTrendSourceConfig(storedUserConfig ?? defaults);

  const pageData: TrendRadarPageData = {
    globalInProgress: globalInProgress
      ? { id: globalInProgress.id, status: globalInProgress.status }
      : null,
    latestGlobal: latestGlobal
      ? {
          id: latestGlobal.id,
          narrative: latestGlobal.narrative,
          generatedAt: latestGlobal.generatedAt?.toISOString() ?? null,
          status: latestGlobal.status,
          digestMode: latestGlobal.digestMode,
          dataNotice: latestGlobal.dataNotice,
          signalStats: parseSignalStats(latestGlobal.signalStats),
          items: latestGlobal.items.map((i) => ({
            id: i.id,
            name: i.name,
            phase: i.phase,
            dimension: i.dimension,
            isGlobalPipeline: i.isGlobalPipeline,
            tmiScore: i.tmiScore ?? i.score,
            confidence: i.confidence,
            wowStatus: i.wowStatus,
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
      sourceConfig: parseTrendSourceConfigJson(w.sourceConfig),
      latestDigest: w.digests[0]
        ? {
            id: w.digests[0].id,
            status: w.digests[0].status,
            generatedAt: w.digests[0].generatedAt?.toISOString() ?? null,
          }
        : null,
    })),
    globalSourceConfig,
    tiktokConfigured: isTikTokTrendsConfigured(),
  };

  return (
    <ResearchHubModulePage
      icon={Radar}
      title="Trend Radar"
      description="Deteksi tren bahan, klaim, dan kategori — digest mingguan + watchlist kustom."
    >
      <TrendRadarClient data={pageData} />
    </ResearchHubModulePage>
  );
}
