import "server-only";

import { prisma } from "@/lib/prisma";
import { enqueueBrandCompetitorScrape } from "@/lib/brand-research/scrape-competitor";

/**
 * Daily scrape for all active Brand Hub competitor shops.
 *
 * Previously the research-sync cron only synced research-hub competitors and tracked
 * products — brand-hub competitor *shops* were never refreshed on a schedule, so their
 * price/rating history could only accumulate if a human clicked Refresh every day.
 */
export async function syncActiveBrandCompetitors(): Promise<{ queued: number }> {
  const competitors = await prisma.brandCompetitor.findMany({
    where: { isActive: true },
    select: { id: true },
  });

  let queued = 0;
  for (const c of competitors) {
    try {
      await enqueueBrandCompetitorScrape(c.id);
      queued += 1;
    } catch (err) {
      console.error("[brand-competitor-sync] gagal enqueue", c.id, err);
    }
  }

  return { queued };
}
