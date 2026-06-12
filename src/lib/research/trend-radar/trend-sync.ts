import "server-only";

import { UserRole } from "@prisma/client";
import { NotificationType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notifyUser } from "@/lib/notify";
import { generateTrendDigest } from "@/lib/research/trend-radar/trend-analyzer";

export async function generateGlobalWeeklyDigest(): Promise<{ digestId: string }> {
  const digestId = await generateTrendDigest({ isGlobal: true });
  return { digestId };
}

export async function generateWatchlistDigests(): Promise<{ queued: number }> {
  const watchlists = await prisma.trendWatchlist.findMany({
    where: { isActive: true },
  });

  let queued = 0;
  for (const wl of watchlists) {
    try {
      await generateTrendDigest({
        isGlobal: false,
        watchlistId: wl.id,
        seedKeywords: wl.keywords,
        watchlistName: wl.name,
      });
      queued += 1;
    } catch (err) {
      console.error("[trend-sync] watchlist gagal", wl.id, err);
    }
  }

  return { queued };
}

export async function notifyTrendDigestReady(): Promise<void> {
  const analysts = await prisma.user.findMany({
    where: { role: UserRole.MARKET_ANALYST },
    select: { id: true },
  });

  const message =
    "Trend Radar minggu ini sudah siap — buka Research Hub untuk lihat digest terbaru.";

  await Promise.allSettled(
    analysts.map((u) =>
      notifyUser(u.id, message, NotificationType.RESEARCH_ALERT),
    ),
  );
}

export async function syncWeeklyTrends(): Promise<{
  global: { digestId: string };
  watchlists: { queued: number };
}> {
  const global = await generateGlobalWeeklyDigest();
  const watchlists = await generateWatchlistDigests();
  await notifyTrendDigestReady();
  return { global, watchlists };
}
