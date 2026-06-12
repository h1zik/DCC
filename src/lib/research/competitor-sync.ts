import "server-only";

import { prisma } from "@/lib/prisma";
import { enqueueCompetitorScrape } from "@/lib/research/scrape-competitor";

/** Jalankan scrape harian untuk semua kompetitor aktif. */
export async function syncActiveCompetitors(): Promise<{ queued: number }> {
  const competitors = await prisma.researchCompetitor.findMany({
    where: { isActive: true },
    select: { id: true },
  });

  let queued = 0;
  for (const c of competitors) {
    try {
      await enqueueCompetitorScrape(c.id);
      queued += 1;
    } catch (err) {
      console.error("[competitor-sync] gagal enqueue", c.id, err);
    }
  }

  return { queued };
}
