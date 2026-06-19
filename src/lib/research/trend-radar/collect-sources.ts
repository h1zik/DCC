import "server-only";

import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { fetchInterestTrend } from "@/lib/research/keyword-intel/google-trends-keywords";
import { fetchBeautyTrendSignals } from "@/lib/research/trend-radar/google-trends";
import { fetchRssTrendSignals } from "@/lib/research/trend-radar/rss-feeds";
import { fetchTikTokTrendSignals } from "@/lib/research/trend-radar/tiktok-trends";
import { fetchBpomTrendSignals } from "@/lib/research/trend-radar/bpom-scraper";
import { enabledRssFeedUrls } from "@/lib/research/trend-radar/trend-source-config-types";
import type { TrendSourceConfig } from "@/lib/research/trend-radar/trend-source-config-types";
import { getDefaultTrendSourceConfig } from "@/lib/research/trend-radar/trend-source-config";
import type { NormalizedTrendSignal } from "@/lib/research/trend-radar/trend-signal-types";

const DEFAULT_SEEDS = [
  "skincare indonesia",
  "bodycare",
  "sunscreen",
  "serum brightening",
  "kosmetik lokal",
];

function signalId(source: string, term: string, metric: string): string {
  return createHash("sha256")
    .update(`${source}|${term}|${metric}`)
    .digest("hex")
    .slice(0, 16);
}

async function bpomSignalsWithDelta(
  seeds: string[],
): Promise<NormalizedTrendSignal[]> {
  const raw = await fetchBpomTrendSignals(seeds);
  const countBySeed = new Map<string, number>();

  for (const seed of seeds) {
    const matching = raw.filter((r) =>
      r.term.toLowerCase().includes(seed.toLowerCase().split(" ")[0] ?? seed),
    );
    countBySeed.set(seed, matching.length || raw.length / Math.max(seeds.length, 1));
  }

  const signals: NormalizedTrendSignal[] = [];

  for (const [seed, count] of countBySeed) {
    const prior = await prisma.trendBpomSnapshot.findFirst({
      where: { seed },
      orderBy: { capturedAt: "desc" },
    });

    await prisma.trendBpomSnapshot.create({
      data: { seed, count },
    });

    const deltaPct =
      prior && prior.count > 0
        ? ((count - prior.count) / prior.count) * 100
        : null;

    signals.push({
      signalId: signalId("bpom", seed, "registration_count"),
      source: "bpom",
      term: seed,
      metric: "registration_count",
      value: count,
      deltaPct,
      url: "https://cekbpom.pom.go.id/produk-kosmetika",
    });
  }

  for (const item of raw.slice(0, 20)) {
    signals.push({
      signalId: signalId("bpom", item.term, "product_registration"),
      source: "bpom",
      term: item.term,
      metric: "product_registration",
      value: 1,
      url: "https://cekbpom.pom.go.id/produk-kosmetika",
      meta: {
        productName: item.productName,
        brandName: item.brandName,
      },
    });
  }

  return signals;
}

export async function collectExternalTrendSignals(
  seedKeywords: string[] = [],
  sourceConfig: TrendSourceConfig = getDefaultTrendSourceConfig(),
): Promise<NormalizedTrendSignal[]> {
  const seeds =
    seedKeywords.length > 0 ? seedKeywords : DEFAULT_SEEDS;
  const signals: NormalizedTrendSignal[] = [];

  if (sourceConfig.enabled.googleTrends) {
    const gtRows = await fetchBeautyTrendSignals(seeds);
    for (const g of gtRows) {
      signals.push({
        signalId: signalId("google_trends", g.term, g.rising ? "rising" : "top"),
        source: "google_trends",
        term: g.term,
        metric: g.rising ? "rising_query" : "top_query",
        value: Number(g.value ?? 0),
        meta: { rising: g.rising, seed: g.source },
      });
    }

    const topTerms = [...new Set(gtRows.map((g) => g.term))].slice(0, 8);
    for (const term of topTerms) {
      try {
        const trend = await fetchInterestTrend(term);
        if (trend === "up") {
          signals.push({
            signalId: signalId("google_trends", term, "interest_up"),
            source: "google_trends",
            term,
            metric: "interest_over_time",
            value: 1,
            meta: { trend: "up" },
          });
        } else if (trend === "down") {
          signals.push({
            signalId: signalId("google_trends", term, "interest_down"),
            source: "google_trends",
            term,
            metric: "interest_over_time",
            value: -1,
            meta: { trend: "down" },
          });
        }
      } catch {
        /* skip */
      }
    }
  }

  if (sourceConfig.enabled.rss) {
    const feedUrls = enabledRssFeedUrls(sourceConfig);
    const rssRows = await fetchRssTrendSignals(feedUrls);
    for (const r of rssRows) {
      signals.push({
        signalId: signalId("rss", r.term.slice(0, 80), "headline"),
        source: "rss",
        term: r.title,
        metric: "headline",
        value: 1,
        url: r.link ?? null,
        meta: { feed: r.source },
      });
    }
  }

  if (sourceConfig.enabled.tiktok) {
    const ttRows = await fetchTikTokTrendSignals(sourceConfig.tiktokHashtags);
    for (const t of ttRows) {
      signals.push({
        signalId: signalId("tiktok", t.term, "views"),
        source: "tiktok",
        term: t.term,
        metric: "views",
        value: Number(t.views ?? 0),
        meta: { source: t.source },
      });
    }
  }

  if (sourceConfig.enabled.bpom) {
    signals.push(...(await bpomSignalsWithDelta(seeds)));
  }

  return signals;
}

/** @deprecated Use collectExternalTrendSignals — kept for legacy imports. */
export type CollectedTrendRaw = {
  signals: {
    term: string;
    source: string;
    meta?: Record<string, unknown>;
  }[];
};

export async function collectTrendSources(
  seedKeywords: string[] = [],
  sourceConfig: TrendSourceConfig = getDefaultTrendSourceConfig(),
): Promise<CollectedTrendRaw> {
  const normalized = await collectExternalTrendSignals(seedKeywords, sourceConfig);
  return {
    signals: normalized.map((s) => ({
      term: s.term,
      source: s.source,
      meta: { ...s.meta, value: s.value, metric: s.metric, rising: s.meta?.rising },
    })),
  };
}
