import "server-only";

import { resolveAgentApiKey } from "@/lib/agent/provider";
import { isApifyConfigured } from "@/lib/apify/client";
import { isKeywordsEverywhereConfigured } from "@/lib/research/keyword-intel/keywords-everywhere";
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

export type DashboardData = {
  kpis: DashboardKpis;
  alerts: DashboardAlert[];
  health: ModuleHealth[];
  latestReport: {
    id: string;
    title: string;
    type: string;
    createdAt: string;
  } | null;
  lastTrendDigestAt: string | null;
};

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
  const shopeeReviewsConfigured =
    apifyConfigured && !!process.env.APIFY_ACTOR_SHOPEE_REVIEWS?.trim();
  const shopeeShopConfigured =
    apifyConfigured && !!process.env.APIFY_ACTOR_SHOPEE_SHOP?.trim();
  const keywordsConfigured = isKeywordsEverywhereConfigured();
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
    uspReady,
    conceptDrafts,
    conceptReady,
    latestReport,
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
      where: { isGlobal: true, status: "READY" },
      orderBy: { generatedAt: "desc" },
      include: {
        items: {
          where: { phase: "EMERGING" },
          orderBy: { score: "desc" },
          take: 5,
        },
      },
    }),
    prisma.keywordIntelQuery.count({ where: { status: "READY" } }),
    prisma.socialListeningBatch.count({ where: { status: "READY" } }),
    prisma.uspGapAnalysis.count({ where: { status: "READY" } }),
    prisma.productConcept.count({ where: { status: "DRAFT" } }),
    prisma.productConcept.count({ where: { status: "READY" } }),
    prisma.researchReport.findFirst({
      where: { status: "READY" },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, type: true, createdAt: true },
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

  if (latestGlobalDigest) {
    for (const item of latestGlobalDigest.items) {
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

  const health: ModuleHealth[] = [
    {
      key: "review-intelligence",
      level: reviewHealthLevel({
        configured: shopeeReviewsConfigured,
        ready: reviewReady,
        failed: reviewFailed,
        partial: reviewPartial,
      }),
      detail: shopeeReviewsConfigured
        ? reviewPartial > 0
          ? `${reviewPartial} sumber data parsial`
          : `${reviewReady} sumber siap`
        : "Scraper belum dikonfigurasi",
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
      level: !trendConfigured ? "demo" : !latestGlobalDigest ? "idle" : "partial",
      detail: !trendConfigured
        ? "TikTok trends belum dikonfigurasi"
        : "BPOM masih demo",
    },
    {
      key: "keyword-intel",
      level: !keywordsConfigured ? "demo" : keywordReady === 0 ? "idle" : "live",
      detail: keywordsConfigured
        ? `${keywordReady} query siap`
        : "Keywords Everywhere belum diset",
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
      emergingTrends: latestGlobalDigest?.items.length ?? 0,
      conceptDrafts,
      conceptReady,
    },
    alerts: alerts.slice(0, 8),
    health,
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
