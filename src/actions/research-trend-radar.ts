"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { TrendDimension, TrendRadarStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireMarketAnalyst } from "@/lib/research/auth";
import {
  generateTrendDigest,
  weekBounds,
} from "@/lib/research/trend-radar/trend-analyzer";
import {
  getDefaultTrendSourceConfig,
  parseTrendSourceConfigJson,
  resolveTrendSourceConfig,
  trendSourceConfigSchema,
  validateTrendSourceConfig,
} from "@/lib/research/trend-radar/trend-source-config";
import type { TrendSourceConfig } from "@/lib/research/trend-radar/trend-source-config-types";

const watchlistSchema = z.object({
  name: z.string().min(1).max(120),
  keywords: z.array(z.string().min(1).max(100)).min(1).max(20),
  dimensions: z.array(z.nativeEnum(TrendDimension)).optional(),
  sourceConfig: trendSourceConfigSchema.optional(),
});

const updateWatchlistSchema = z.object({
  watchlistId: z.string().min(1),
  name: z.string().min(1).max(120).optional(),
  keywords: z.array(z.string().min(1).max(100)).min(1).max(20).optional(),
  sourceConfig: trendSourceConfigSchema.optional(),
});

export async function getTrendRadarSourceDefaults(): Promise<{
  defaults: TrendSourceConfig;
  userSettings: TrendSourceConfig | null;
}> {
  const session = await requireMarketAnalyst();
  const defaults = getDefaultTrendSourceConfig();

  const row = await prisma.trendRadarUserSettings.findUnique({
    where: { userId: session.user.id },
  });

  const userSettings = row?.sourceConfig
    ? parseTrendSourceConfigJson(row.sourceConfig)
    : null;

  return {
    defaults,
    userSettings,
  };
}

async function saveUserSourceConfig(
  userId: string,
  config: TrendSourceConfig,
): Promise<void> {
  await prisma.trendRadarUserSettings.upsert({
    where: { userId },
    create: { userId, sourceConfig: config as object },
    update: { sourceConfig: config as object },
  });
}

export async function createTrendWatchlist(
  input: z.infer<typeof watchlistSchema>,
) {
  const session = await requireMarketAnalyst();
  const data = watchlistSchema.parse(input);

  const sourceConfig = data.sourceConfig
    ? validateTrendSourceConfig(data.sourceConfig)
    : getDefaultTrendSourceConfig();

  const watchlist = await prisma.trendWatchlist.create({
    data: {
      name: data.name,
      keywords: data.keywords.map((k) => k.trim()),
      dimensions: data.dimensions ?? [],
      sourceConfig: sourceConfig as object,
      createdById: session.user.id,
    },
  });

  revalidatePath("/research-hub/trend-radar");
  return { id: watchlist.id };
}

export async function updateTrendWatchlist(
  input: z.infer<typeof updateWatchlistSchema>,
) {
  await requireMarketAnalyst();
  const data = updateWatchlistSchema.parse(input);

  const existing = await prisma.trendWatchlist.findUnique({
    where: { id: data.watchlistId },
  });
  if (!existing) throw new Error("Watchlist tidak ditemukan.");

  const sourceConfig = data.sourceConfig
    ? validateTrendSourceConfig(data.sourceConfig)
    : undefined;

  await prisma.trendWatchlist.update({
    where: { id: data.watchlistId },
    data: {
      ...(data.name ? { name: data.name } : {}),
      ...(data.keywords
        ? { keywords: data.keywords.map((k) => k.trim()) }
        : {}),
      ...(sourceConfig ? { sourceConfig: sourceConfig as object } : {}),
    },
  });

  revalidatePath("/research-hub/trend-radar");
}

export async function deleteTrendWatchlist(watchlistId: string) {
  await requireMarketAnalyst();
  z.string().min(1).parse(watchlistId);

  await prisma.trendWatchlist.delete({ where: { id: watchlistId } });
  revalidatePath("/research-hub/trend-radar");
}

export async function refreshTrendWatchlist(
  watchlistId: string,
  sourceConfigInput?: TrendSourceConfig,
) {
  await requireMarketAnalyst();
  z.string().min(1).parse(watchlistId);

  const watchlist = await prisma.trendWatchlist.findUnique({
    where: { id: watchlistId },
  });
  if (!watchlist) throw new Error("Watchlist tidak ditemukan.");

  const stored = parseTrendSourceConfigJson(watchlist.sourceConfig);
  const sourceConfig = sourceConfigInput
    ? validateTrendSourceConfig(sourceConfigInput)
    : stored ?? getDefaultTrendSourceConfig();

  if (sourceConfigInput) {
    await prisma.trendWatchlist.update({
      where: { id: watchlistId },
      data: { sourceConfig: sourceConfig as object },
    });
  }

  try {
    await generateTrendDigest({
      isGlobal: false,
      watchlistId: watchlist.id,
      seedKeywords: watchlist.keywords,
      watchlistName: watchlist.name,
      sourceConfig,
    });
  } catch (err) {
    console.error("[refreshTrendWatchlist] gagal", err);
    throw err;
  }

  revalidatePath("/research-hub/trend-radar");
}

export async function refreshGlobalTrendDigest(
  sourceConfigInput?: TrendSourceConfig,
) {
  const session = await requireMarketAnalyst();

  let sourceConfig: TrendSourceConfig;
  if (sourceConfigInput) {
    sourceConfig = validateTrendSourceConfig(sourceConfigInput);
    await saveUserSourceConfig(session.user.id, sourceConfig);
  } else {
    const row = await prisma.trendRadarUserSettings.findUnique({
      where: { userId: session.user.id },
    });
    const stored = row?.sourceConfig
      ? parseTrendSourceConfigJson(row.sourceConfig)
      : null;
    sourceConfig = stored ?? getDefaultTrendSourceConfig();
  }

  const inFlight = await prisma.trendRadarDigest.findFirst({
    where: {
      isGlobal: true,
      status: {
        in: [TrendRadarStatus.COLLECTING, TrendRadarStatus.ANALYZING],
      },
    },
  });
  if (inFlight) {
    throw new Error(
      "Digest global sedang diproses. Tunggu hingga selesai sebelum generate ulang.",
    );
  }

  const { weekStart, weekEnd } = weekBounds();
  const digest = await prisma.trendRadarDigest.create({
    data: {
      weekStart,
      weekEnd,
      isGlobal: true,
      status: TrendRadarStatus.COLLECTING,
      sourceConfig: sourceConfig as object,
    },
  });

  after(async () => {
    try {
      await generateTrendDigest({
        digestId: digest.id,
        isGlobal: true,
        sourceConfig,
      });
    } catch (err) {
      console.error("[refreshGlobalTrendDigest] background gagal", err);
    } finally {
      revalidatePath("/research-hub/trend-radar");
    }
  });

  revalidatePath("/research-hub/trend-radar");
  return { digestId: digest.id };
}

export async function deleteTrendDigest(digestId: string) {
  await requireMarketAnalyst();
  z.string().min(1).parse(digestId);

  await prisma.trendRadarDigest.delete({ where: { id: digestId } });
  revalidatePath("/research-hub/trend-radar");
}

/** Resolve config for UI hydration (global or watchlist). */
export async function resolveTrendConfigForUi(input: {
  watchlistId?: string | null;
}): Promise<TrendSourceConfig> {
  const session = await requireMarketAnalyst();
  const defaults = getDefaultTrendSourceConfig();

  if (input.watchlistId) {
    const watchlist = await prisma.trendWatchlist.findUnique({
      where: { id: input.watchlistId },
      select: { sourceConfig: true },
    });
    const stored = parseTrendSourceConfigJson(watchlist?.sourceConfig);
    return resolveTrendSourceConfig(stored ?? defaults);
  }

  const row = await prisma.trendRadarUserSettings.findUnique({
    where: { userId: session.user.id },
  });
  const stored = row?.sourceConfig
    ? parseTrendSourceConfigJson(row.sourceConfig)
    : null;
  return resolveTrendSourceConfig(stored ?? defaults);
}
