import "server-only";

import { SeoCrawlFrequency } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  ANALYZING_STALE_MS,
  CRAWL_TIMEOUT_MS,
  startSiteCrawl,
} from "@/lib/seo/crawler/crawler";
import { SEO_STALE_RUN_MS } from "@/lib/seo/labels";

/**
 * Jalankan jadwal crawl yang due (cron `mode=crawls`, harian). Maksimal 2
 * crawl simultan agar biaya & beban DataForSEO terkendali.
 */

const MAX_CONCURRENT_SCHEDULED = 2;

export function nextRunAfter(
  frequency: SeoCrawlFrequency,
  from: Date,
): Date {
  const days =
    frequency === SeoCrawlFrequency.WEEKLY
      ? 7
      : frequency === SeoCrawlFrequency.BIWEEKLY
        ? 14
        : 30;
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
}

export async function runDueCrawlSchedules(): Promise<{
  started: number;
  skipped: number;
}> {
  const due = await prisma.seoCrawlSchedule.findMany({
    where: { isActive: true, nextRunAt: { lte: new Date() } },
    orderBy: { nextRunAt: "asc" },
  });
  if (due.length === 0) return { started: 0, skipped: 0 };

  // Jangan menumpuk: hitung crawl yang masih berjalan. Baris macet (tidak
  // bergerak melewati batas waktunya masing-masing) tidak dihitung agar dua
  // crawl yang nyangkut tidak memblokir jadwal selamanya.
  const now = Date.now();
  const running = await prisma.seoSiteCrawl.count({
    where: {
      OR: [
        { status: "PENDING", updatedAt: { gte: new Date(now - SEO_STALE_RUN_MS) } },
        { status: "COLLECTING", updatedAt: { gte: new Date(now - CRAWL_TIMEOUT_MS) } },
        { status: "ANALYZING", updatedAt: { gte: new Date(now - ANALYZING_STALE_MS) } },
      ],
    },
  });
  const slots = Math.max(0, MAX_CONCURRENT_SCHEDULED - running);

  let started = 0;
  for (const schedule of due.slice(0, slots)) {
    try {
      const crawl = await prisma.seoSiteCrawl.create({
        data: {
          name: `Audit terjadwal ${schedule.domain}`,
          domain: schedule.domain,
          maxPages: schedule.maxPages,
          includeLighthouse: schedule.includeLighthouse,
          scheduleId: schedule.id,
          createdById: schedule.createdById,
        },
      });
      await startSiteCrawl(crawl.id);
      await prisma.seoCrawlSchedule.update({
        where: { id: schedule.id },
        data: {
          lastCrawlId: crawl.id,
          nextRunAt: nextRunAfter(schedule.frequency, new Date()),
        },
      });
      started += 1;
    } catch (err) {
      console.error("[seo/crawl-schedule] gagal memulai", schedule.id, err);
      // Majukan nextRunAt agar tidak retry-loop tiap cron.
      await prisma.seoCrawlSchedule.update({
        where: { id: schedule.id },
        data: { nextRunAt: nextRunAfter(schedule.frequency, new Date()) },
      });
    }
  }

  return { started, skipped: due.length - started };
}
