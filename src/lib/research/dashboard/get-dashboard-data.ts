import "server-only";

import { ResearchMarketplace } from "@prisma/client";
import { resolveAgentApiKey } from "@/lib/agent/provider";
import { isApifyConfigured } from "@/lib/apify/client";
import {
  configuredReviewPlatformLabels,
  isAnyReviewScrapeConfigured,
} from "@/lib/review-platforms/registry";
import { isProductSearchConfigured, isShopScrapeConfigured } from "@/lib/apify/actors";
import { isInstagramMentionsConfigured } from "@/lib/research/social-listening/scrape-instagram-mentions";
import { isTikTokMentionsConfigured } from "@/lib/research/social-listening/scrape-tiktok-mentions";
import { isTikTokTrendsConfigured } from "@/lib/research/trend-radar/tiktok-trends";
import { prisma } from "@/lib/prisma";

export type DataHealthLevel = "live" | "partial" | "demo" | "idle";

export type ModuleHealth = {
  key: string;
  level: DataHealthLevel;
  detail: string;
};

export type DashboardAlert = {
  id: string;
  kind: "competitor" | "trend";
  title: string;
  subtitle: string;
  severity: "info" | "warning" | "critical";
  href: string;
  createdAt: string;
};

export type DashboardKpis = {
  reviewReady: number;
  reviewInProgress: number;
  reviewPartial: number;
  competitorsActive: number;
  unreadAlerts: number;
  emergingTrends: number;
  conceptDrafts: number;
  conceptReady: number;
};

export type DashboardRecommendation = {
  id: string;
  module: string;
  owner: string;
  priority: string;
  action: string;
  rationale: string;
  confidence: number;
  effort: string;
  horizon: string;
  sourceLabel: string | null;
  href: string | null;
};

export type DashboardData = {
  kpis: DashboardKpis;
  alerts: DashboardAlert[];
  health: ModuleHealth[];
  recommendations: DashboardRecommendation[];
  latestReport: {
    id: string;
    title: string;
    type: string;
    createdAt: string;
  } | null;
  lastTrendDigestAt: string | null;
};

const PRIORITY_RANK: Record<string, number> = { P0: 0, P1: 1, P2: 2 };

function reviewHealthLevel(opts: {
  configured: boolean;
  ready: number;
  failed: number;
  partial: number;
}): DataHealthLevel {
  if (!opts.configured) return "demo";
  if (opts.ready === 0 && opts.failed === 0) return "idle";
  if (opts.partial > 0 || opts.failed > 0) return "partial";
  return "live";
}

export async function getResearchDashboardData(): Promise<DashboardData> {
  const aiConfigured = !!resolveAgentApiKey();
  const apifyConfigured = isApifyConfigured();
  const reviewScrapeConfigured = isAnyReviewScrapeConfigured();
  const reviewPlatformLabels = configuredReviewPlatformLabels();
  const shopeeShopConfigured = isShopScrapeConfigured(ResearchMarketplace.SHOPEE);
  const productDiscoveryConfigured = isProductSearchConfigured(
    ResearchMarketplace.SHOPEE,
  );
  const socialConfigured =
    isTikTokMentionsConfigured() || isInstagramMentionsConfigured();
  const trendConfigured = isTikTokTrendsConfigured();

  const [
    reviewReady,
    reviewInProgress,
    reviewFailed,
    reviewPartial,
    competitorsActive,
    unreadAlerts,
    competitorAlerts,
    latestGlobalDigest,
    keywordReady,
    socialReady,
    productDiscoveryReady,
    uspReady,
    conceptDrafts,
    conceptReady,
    latestReport,
    recommendationsRaw,
  ] = await Promise.all([
    prisma.reviewIntelSource.count({ where: { status: "READY" } }),
    prisma.reviewIntelSource.count({
      where: { status: { in: ["SCRAPING", "ANALYZING"] } },
    }),
    prisma.reviewIntelSource.count({ where: { status: "FAILED" } }),
    prisma.reviewIntelSource.count({ where: { reviewsComplete: false } }),
    prisma.researchCompetitor.count({ where: { isActive: true } }),
    prisma.competitorAlert.count({ where: { isRead: false } }),
    prisma.competitorAlert.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      include: { competitor: { select: { name: true, brand: true } } },
    }),
    prisma.trendRadarDigest.findFirst({
      where: { isGlobal: true, status: "READY", digestMode: "LIVE" },
      orderBy: { generatedAt: "desc" },
      include: {
        items: {
          where: { phase: "EMERGING", confidence: { not: "LOW" } },
          orderBy: { tmiScore: "desc" },
          take: 5,
        },
      },
    }),
    prisma.keywordIntelQuery.count({ where: { status: "READY" } }),
    prisma.socialListeningBatch.count({ where: { status: "READY" } }),
    prisma.productDiscoveryQuery.count({ where: { status: "READY" } }),
    prisma.uspGapAnalysis.count({ where: { status: "READY" } }),
    prisma.productConcept.count({ where: { status: "DRAFT" } }),
    prisma.productConcept.count({ where: { status: "READY" } }),
    prisma.researchReport.findFirst({
      where: { status: "READY" },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, type: true, createdAt: true },
    }),
    prisma.researchRecommendation.findMany({
      where: { status: "OPEN" },
      orderBy: { createdAt: "desc" },
      take: 40,
    }),
  ]);

  const alerts: DashboardAlert[] = [];

  for (const a of competitorAlerts) {
    alerts.push({
      id: a.id,
      kind: "competitor",
      title: a.message,
      subtitle: `${a.competitor.brand} · ${a.competitor.name}`,
      severity:
        a.severity === "critical"
          ? "critical"
          : a.severity === "warning"
            ? "warning"
            : "info",
      href: `/research-hub/competitor-tracker/${a.competitorId}`,
      createdAt: a.createdAt.toISOString(),
    });
  }

  if (latestGlobalDigest && latestGlobalDigest.digestMode === "LIVE") {
    for (const item of latestGlobalDigest.items) {
      if (item.confidence === "LOW") continue;
      alerts.push({
        id: item.id,
        kind: "trend",
        title: `Tren emerging: ${item.name}`,
        subtitle: "Trend Radar — sinyal dini",
        severity: "info",
        href: `/research-hub/trend-radar/${latestGlobalDigest.id}`,
        createdAt: (
          latestGlobalDigest.generatedAt ?? latestGlobalDigest.createdAt
        ).toISOString(),
      });
    }
  }

  alerts.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const recommendations: DashboardRecommendation[] = recommendationsRaw
    .map((r) => ({
      id: r.id,
      module: r.module,
      owner: r.owner,
      priority: r.priority,
      action: r.action,
      rationale: r.rationale,
      confidence: r.confidence,
      effort: r.effort,
      horizon: r.horizon,
      sourceLabel: r.sourceLabel,
      href: r.href,
    }))
    .sort((a, b) => {
      const pr = (PRIORITY_RANK[a.priority] ?? 1) - (PRIORITY_RANK[b.priority] ?? 1);
      if (pr !== 0) return pr;
      return b.confidence - a.confidence;
    })
    .slice(0, 12);

  const health: ModuleHealth[] = [
    {
      key: "product-discovery",
      level: !productDiscoveryConfigured
        ? "demo"
        : productDiscoveryReady === 0
          ? "idle"
          : "live",
      detail: productDiscoveryConfigured
        ? `${productDiscoveryReady} pencarian siap`
        : "Scraper Shopee belum dikonfigurasi",
    },
    {
      key: "review-intelligence",
      level: reviewHealthLevel({
        configured: reviewScrapeConfigured,
        ready: reviewReady,
        failed: reviewFailed,
        partial: reviewPartial,
      }),
      detail: reviewScrapeConfigured
        ? reviewPartial > 0
          ? `${reviewPlatformLabels.join(", ")} · ${reviewPartial} parsial`
          : `${reviewPlatformLabels.join(", ")} · ${reviewReady} siap`
        : "Scraper review belum dikonfigurasi (Apify actor per platform)",
    },
    {
      key: "competitor-tracker",
      level: !shopeeShopConfigured
        ? "demo"
        : competitorsActive === 0
          ? "idle"
          : "live",
      detail: shopeeShopConfigured
        ? `${competitorsActive} kompetitor aktif`
        : "Scraper toko belum dikonfigurasi",
    },
    {
      key: "trend-radar",
      level: !latestGlobalDigest ? "idle" : "live",
      detail: latestGlobalDigest
        ? "Digest mingguan + BPOM via cekbpom"
        : trendConfigured
          ? "Siap generate — atur sumber di Trend Radar"
          : "Generate digest dari halaman Trend Radar",
    },
    {
      key: "keyword-intel",
      level: keywordReady === 0 ? "idle" : "live",
      detail:
        keywordReady === 0
          ? "Buat query di Keyword Intel"
          : `${keywordReady} query siap`,
    },
    {
      key: "social-listening",
      level: !socialConfigured ? "demo" : socialReady === 0 ? "idle" : "live",
      detail: socialConfigured
        ? `${socialReady} batch siap`
        : "Scraper sosial belum dikonfigurasi",
    },
    {
      key: "usp-analyzer",
      level: !aiConfigured ? "demo" : uspReady === 0 ? "idle" : "live",
      detail: aiConfigured ? `${uspReady} analisis siap` : "AI belum dikonfigurasi",
    },
    {
      key: "concept-lab",
      level: !aiConfigured
        ? "demo"
        : conceptDrafts + conceptReady === 0
          ? "idle"
          : "live",
      detail: aiConfigured
        ? `${conceptDrafts} draft · ${conceptReady} siap`
        : "AI belum dikonfigurasi",
    },
    {
      key: "research-reports",
      level: !aiConfigured ? "demo" : !latestReport ? "idle" : "live",
      detail: aiConfigured
        ? latestReport
          ? "Laporan tersedia"
          : "Belum ada laporan"
        : "AI belum dikonfigurasi",
    },
  ];

  return {
    kpis: {
      reviewReady,
      reviewInProgress,
      reviewPartial,
      competitorsActive,
      unreadAlerts,
      emergingTrends:
        latestGlobalDigest?.digestMode === "LIVE"
          ? latestGlobalDigest.items.filter((i) => i.confidence !== "LOW").length
          : 0,
      conceptDrafts,
      conceptReady,
    },
    alerts: alerts.slice(0, 8),
    health,
    recommendations,
    latestReport: latestReport
      ? {
          id: latestReport.id,
          title: latestReport.title,
          type: latestReport.type,
          createdAt: latestReport.createdAt.toISOString(),
        }
      : null,
    lastTrendDigestAt:
      latestGlobalDigest?.generatedAt?.toISOString() ??
      latestGlobalDigest?.createdAt.toISOString() ??
      null,
  };
}
