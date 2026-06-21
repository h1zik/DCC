import "server-only";

import {
  ResearchMarketplace,
  ResearchScrapeJobType,
  SocialListeningPlatform,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { MARKETPLACE_LABELS } from "@/lib/research/labels";
import { SOCIAL_LISTENING_PLATFORM_LABELS } from "@/lib/research/labels";
import {
  parseProductDiscoveryScrapeState,
} from "@/lib/research/product-discovery/scrape-state";
import type {
  DataProvenanceEntry,
  ScrapeDataProvider,
} from "@/lib/research/scrape-data-provider";
import { PLATFORM_STATUS_PROVIDERS_KEY } from "@/lib/research/scrape-data-provider";
import { buildKeywordDataProvenance } from "@/lib/research/keyword-intel/build-keyword-provenance";
import type {
  KeywordSignalStats,
  NormalizedKeywordSignal,
} from "@/lib/research/keyword-intel/keyword-signal-types";
import { usesNativeReviewScrape } from "@/lib/review-scrape/native-scrape";
import { isScraperApiConfigured } from "@/lib/scraper-api/client";

export type PlatformScrapeProviders = Partial<
  Record<SocialListeningPlatform, ScrapeDataProvider>
>;

export function parsePlatformScrapeProviders(
  raw: unknown,
): PlatformScrapeProviders {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const o = raw as Record<string, unknown>;
  const providersRaw = o[PLATFORM_STATUS_PROVIDERS_KEY];
  if (!providersRaw || typeof providersRaw !== "object" || Array.isArray(providersRaw)) {
    return {};
  }
  const out: PlatformScrapeProviders = {};
  for (const [key, value] of Object.entries(providersRaw)) {
    if (key === PLATFORM_STATUS_PROVIDERS_KEY) continue;
    if (
      value === "vps" ||
      value === "apify" ||
      value === "demo" ||
      value === "native"
    ) {
      out[key as SocialListeningPlatform] = value;
    }
  }
  return out;
}

export function socialListeningProvenance(
  platforms: SocialListeningPlatform[],
  providers: PlatformScrapeProviders,
): DataProvenanceEntry[] {
  return platforms.map((platform) => ({
    label: SOCIAL_LISTENING_PLATFORM_LABELS[platform],
    provider: providers[platform] ?? "apify",
    isFallback: providers[platform] === "apify",
  }));
}

export function productDiscoveryProvenance(input: {
  marketplaces: ResearchMarketplace[];
  scrapeState: unknown;
  errorMessage: string | null;
}): DataProvenanceEntry[] {
  if (input.errorMessage?.toLowerCase().includes("demo")) {
    return input.marketplaces.map((mp) => ({
      label: MARKETPLACE_LABELS[mp],
      provider: "demo" as const,
    }));
  }

  const state = parseProductDiscoveryScrapeState(
    input.scrapeState,
    input.marketplaces,
  );

  if (state.sources && Object.keys(state.sources).length > 0) {
    return input.marketplaces
      .filter((mp) => state.sources![mp])
      .map((mp) => {
        const provider = state.sources![mp]!;
        return {
          label: MARKETPLACE_LABELS[mp],
          provider,
          isFallback: provider === "apify",
        };
      });
  }

  return input.marketplaces.map((mp) => {
    const usedApifyFallback = state.warnings.some(
      (w) =>
        w.startsWith(`${mp}:`) &&
        w.toLowerCase().includes("apify"),
    );
    const defaultProvider: ScrapeDataProvider =
      mp === ResearchMarketplace.TIKTOK_SHOP
        ? "apify"
        : isScraperApiConfigured() && !usedApifyFallback
          ? "vps"
          : "apify";
    return {
      label: MARKETPLACE_LABELS[mp],
      provider: usedApifyFallback ? "apify" : defaultProvider,
      isFallback: usedApifyFallback,
    };
  });
}

async function latestCompletedJobProvider(
  entityId: string,
  type: ResearchScrapeJobType,
): Promise<ScrapeDataProvider | null> {
  const job = await prisma.researchScrapeJob.findFirst({
    where: { entityId, type, status: "COMPLETED" },
    orderBy: { completedAt: "desc" },
    select: { apifyRunId: true },
  });
  if (!job) return null;
  return job.apifyRunId ? "apify" : "vps";
}

export async function competitorScrapeProvenance(input: {
  competitorId: string;
  marketplace: ResearchMarketplace;
  hasProducts: boolean;
}): Promise<DataProvenanceEntry[]> {
  const provider = await latestCompletedJobProvider(
    input.competitorId,
    ResearchScrapeJobType.COMPETITOR_SNAPSHOT,
  );

  if (!provider) {
    if (input.hasProducts) {
      const fallback: ScrapeDataProvider = isScraperApiConfigured()
        ? "vps"
        : "apify";
      return [
        {
          label: `Toko ${MARKETPLACE_LABELS[input.marketplace]}`,
          provider: fallback,
          isFallback: fallback === "apify",
        },
      ];
    }
    return [
      {
        label: `Toko ${MARKETPLACE_LABELS[input.marketplace]}`,
        provider: "demo",
      },
    ];
  }

  return [
    {
      label: `Toko ${MARKETPLACE_LABELS[input.marketplace]}`,
      provider,
      isFallback: provider === "apify",
    },
  ];
}

export async function reviewScrapeProvenance(input: {
  sourceId: string;
  platformKey: string | null;
  productName: string;
}): Promise<DataProvenanceEntry[]> {
  const platformKey = input.platformKey ?? "shopee";

  if (platformKey === "csv") {
    return [{ label: input.productName, provider: "csv" }];
  }

  const job = await prisma.researchScrapeJob.findFirst({
    where: {
      entityId: input.sourceId,
      type: ResearchScrapeJobType.REVIEW_SCRAPE,
      status: "COMPLETED",
    },
    orderBy: { completedAt: "desc" },
    select: { apifyRunId: true },
  });

  if (!job) {
    return [];
  }

  if (job.apifyRunId) {
    return [
      {
        label: input.productName,
        provider: "apify",
        isFallback: true,
      },
    ];
  }

  if (platformKey === "shopee") {
    return [
      {
        label: input.productName,
        provider: "vps",
      },
    ];
  }

  if (usesNativeReviewScrape(platformKey)) {
    return [
      {
        label: input.productName,
        provider: "native",
      },
    ];
  }

  return [
    {
      label: input.productName,
      provider: "demo",
    },
  ];
}

export function keywordIntelProvenance(
  signalStats: KeywordSignalStats | null,
  signals?: NormalizedKeywordSignal[],
): DataProvenanceEntry[] {
  if (!signalStats) return [];
  if (signalStats.provenance?.length) {
    return signalStats.provenance;
  }
  if (signals?.length) {
    return buildKeywordDataProvenance({ signals, stats: signalStats });
  }
  return buildKeywordDataProvenanceFromStatsOnly(signalStats);
}

function buildKeywordDataProvenanceFromStatsOnly(
  stats: KeywordSignalStats,
): DataProvenanceEntry[] {
  return buildKeywordDataProvenance({
    signals: [],
    stats,
  });
}
