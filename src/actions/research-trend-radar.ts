"use server";

import { revalidatePath } from "next/cache";
import { TrendDimension } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireMarketAnalyst } from "@/lib/research/auth";
import { generateTrendDigest } from "@/lib/research/trend-radar/trend-analyzer";

const watchlistSchema = z.object({
  name: z.string().min(1).max(120),
  keywords: z.array(z.string().min(1).max(100)).min(1).max(20),
  dimensions: z.array(z.nativeEnum(TrendDimension)).optional(),
});

export async function createTrendWatchlist(
  input: z.infer<typeof watchlistSchema>,
) {
  const session = await requireMarketAnalyst();
  const data = watchlistSchema.parse(input);

  const watchlist = await prisma.trendWatchlist.create({
    data: {
      name: data.name,
      keywords: data.keywords.map((k) => k.trim()),
      dimensions: data.dimensions ?? [],
      createdById: session.user.id,
    },
  });

  revalidatePath("/research-hub/trend-radar");
  return { id: watchlist.id };
}

export async function deleteTrendWatchlist(watchlistId: string) {
  await requireMarketAnalyst();
  z.string().min(1).parse(watchlistId);

  await prisma.trendWatchlist.delete({ where: { id: watchlistId } });
  revalidatePath("/research-hub/trend-radar");
}

export async function refreshTrendWatchlist(watchlistId: string) {
  await requireMarketAnalyst();
  z.string().min(1).parse(watchlistId);

  const watchlist = await prisma.trendWatchlist.findUnique({
    where: { id: watchlistId },
  });
  if (!watchlist) throw new Error("Watchlist tidak ditemukan.");

  try {
    await generateTrendDigest({
      isGlobal: false,
      watchlistId: watchlist.id,
      seedKeywords: watchlist.keywords,
      watchlistName: watchlist.name,
    });
  } catch (err) {
    console.error("[refreshTrendWatchlist] gagal", err);
    throw err;
  }

  revalidatePath("/research-hub/trend-radar");
}

export async function refreshGlobalTrendDigest() {
  await requireMarketAnalyst();

  try {
    await generateTrendDigest({ isGlobal: true });
  } catch (err) {
    console.error("[refreshGlobalTrendDigest] gagal", err);
    throw err;
  }

  revalidatePath("/research-hub/trend-radar");
}

export async function deleteTrendDigest(digestId: string) {
  await requireMarketAnalyst();
  z.string().min(1).parse(digestId);

  await prisma.trendRadarDigest.delete({ where: { id: digestId } });
  revalidatePath("/research-hub/trend-radar");
}
