import "server-only";

import { prisma } from "@/lib/prisma";
import { scrapeCompetitorProductTrack } from "@/lib/research/scrape-competitor-product";

/** Scrape harian semua produk aktif di kategori aktif. */
export async function syncActiveCompetitorProducts(): Promise<{
  queued: number;
}> {
  const tracks = await prisma.competitorProductTrack.findMany({
    where: {
      isActive: true,
      category: { isActive: true },
    },
    select: { id: true },
  });

  let queued = 0;
  for (const track of tracks) {
    try {
      await scrapeCompetitorProductTrack(track.id);
      queued += 1;
    } catch (err) {
      console.error("[competitor-product-sync] gagal", track.id, err);
    }
  }

  return { queued };
}
