import { Radar } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { BrandHubListPage } from "@/components/brand-hub/brand-hub-list-page";
import { isTikTokTrendsConfigured } from "@/lib/research/trend-radar/tiktok-trends";
import { getDefaultTrendSourceConfig } from "@/lib/research/trend-radar/trend-source-config";
import type { TrendSignalStats } from "@/lib/research/trend-radar/trend-signal-types";
import { ensureBrandHubPage } from "../layout";
import {
  BrandTrendRadarClient,
  type BrandTrendRadarPageData,
} from "./brand-trend-radar-client";

function parseSignalStats(raw: unknown): TrendSignalStats | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as TrendSignalStats;
  if (typeof s.total !== "number") return null;
  return s;
}

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
      brandName: d.ownerBrand?.name ?? null,
      itemCount: d._count.items,
      generatedAt: d.generatedAt?.toISOString() ?? null,
    })),
    globalSourceConfig: getDefaultTrendSourceConfig(),
    tiktokConfigured: isTikTokTrendsConfigured(),
  };

  return (
    <BrandHubListPage
      icon={Radar}
      eyebrow="Market Intelligence"
      title="Trend Radar"
      subtitle="Deteksi tren bahan, klaim, dan kategori — digest mingguan berbasis sinyal terverifikasi."
    >
      <BrandTrendRadarClient data={pageData} />
    </BrandHubListPage>
  );
}
