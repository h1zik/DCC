import "server-only";

import { prisma } from "@/lib/prisma";
import {
  getGscSiteUrl,
  gscDate,
  gscSearchAnalytics,
  isGscConfigured,
} from "@/lib/seo/gsc/client";

/**
 * Sinkronisasi harian data GSC → `SeoGscDaily` (dimensi page & query).
 * GSC punya lag data ~2-3 hari, jadi kita tarik ulang jendela 5 hari terakhir
 * (upsert idempoten). Dipanggil cron `mode=gsc`.
 */

const SYNC_WINDOW_DAYS = 5;
const ROWS_PER_DIMENSION_PER_DAY = 500;
const RETENTION_DAYS = 180;

export async function syncGscDaily(): Promise<{
  synced: number;
  pruned: number;
  skipped: boolean;
}> {
  if (!isGscConfigured()) return { synced: 0, pruned: 0, skipped: true };
  const siteUrl = getGscSiteUrl()!;

  let synced = 0;
  // Per hari + per dimensi agar granularitas harian tersimpan rapi.
  for (let daysAgo = 2; daysAgo < 2 + SYNC_WINDOW_DAYS; daysAgo++) {
    const date = gscDate(daysAgo);
    for (const dimension of ["page", "query"] as const) {
      const rows = await gscSearchAnalytics({
        siteUrl,
        startDate: date,
        endDate: date,
        dimensions: [dimension],
        rowLimit: ROWS_PER_DIMENSION_PER_DAY,
      });
      for (const row of rows) {
        const key = row.keys[0];
        if (!key) continue;
        await prisma.seoGscDaily.upsert({
          where: {
            siteUrl_date_dimension_key: {
              siteUrl,
              date: new Date(`${date}T00:00:00Z`),
              dimension,
              key,
            },
          },
          create: {
            siteUrl,
            date: new Date(`${date}T00:00:00Z`),
            dimension,
            key,
            clicks: row.clicks,
            impressions: row.impressions,
            ctr: row.ctr,
            position: row.position,
          },
          update: {
            clicks: row.clicks,
            impressions: row.impressions,
            ctr: row.ctr,
            position: row.position,
          },
        });
        synced += 1;
      }
    }
  }

  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const { count: pruned } = await prisma.seoGscDaily.deleteMany({
    where: { date: { lt: cutoff } },
  });

  return { synced, pruned, skipped: false };
}

/** Ringkasan GSC untuk dashboard: klik & impresi 28 hari vs 28 hari sebelumnya. */
export async function getGscDashboardSummary(): Promise<{
  configured: boolean;
  clicks28: number;
  prevClicks28: number;
  impressions28: number;
  topQueries: { key: string; clicks: number }[];
} | null> {
  if (!isGscConfigured()) return null;
  const siteUrl = getGscSiteUrl()!;
  const now = Date.now();
  const d28 = new Date(now - 28 * 24 * 60 * 60 * 1000);
  const d56 = new Date(now - 56 * 24 * 60 * 60 * 1000);

  const [current, previous, queries] = await Promise.all([
    prisma.seoGscDaily.aggregate({
      where: { siteUrl, dimension: "page", date: { gte: d28 } },
      _sum: { clicks: true, impressions: true },
    }),
    prisma.seoGscDaily.aggregate({
      where: { siteUrl, dimension: "page", date: { gte: d56, lt: d28 } },
      _sum: { clicks: true },
    }),
    prisma.seoGscDaily.groupBy({
      by: ["key"],
      where: { siteUrl, dimension: "query", date: { gte: d28 } },
      _sum: { clicks: true },
      orderBy: { _sum: { clicks: "desc" } },
      take: 5,
    }),
  ]);

  return {
    configured: true,
    clicks28: current._sum.clicks ?? 0,
    prevClicks28: previous._sum.clicks ?? 0,
    impressions28: current._sum.impressions ?? 0,
    topQueries: queries.map((q) => ({
      key: q.key,
      clicks: q._sum.clicks ?? 0,
    })),
  };
}
