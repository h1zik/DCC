"use server";

import {
  BrandCreativeGuidelineStatus,
  BrandStrategyStatus,
  BrandVisualCollectionStatus,
  KeywordIntelStatus,
  ResearchScrapeJobStatus,
  ResearchScrapeJobType,
  TrendRadarStatus,
  UspGapStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireBrandManager } from "@/lib/brand-research/auth";
import { brandStudioBrandFilter } from "@/lib/brand-research/brand-studio-scope";
import { pollBrandAdLibraryBatchesLight } from "@/lib/brand-research/scrape-meta-ads";
import { pollBrandCompetitorScrapeJob } from "@/lib/brand-research/scrape-competitor";
import { pollBrandReviewScrapeJobsLight } from "@/lib/brand-research/run-review-scrape-job";

export type BrandJobSummary = {
  id: string;
  type: string;
  entityId: string;
  status: string;
  percent: number;
  stepLabel: string | null;
  startedAt: string | null;
  label: string;
  href: string;
};

const SCRAPE_TYPE_LABEL: Record<string, string> = {
  REVIEW_SCRAPE: "Review Intelligence",
  COMPETITOR_SNAPSHOT: "Competitor Tracker",
  PINTEREST_SCRAPE: "Visual Library",
  VISUAL_HARVEST: "Visual Harvest",
};

/**
 * Ambang job scrape dianggap "hantu" (orphaned). Di Railway proses bisa mati
 * di tengah scrape (redeploy/scale-down/request timeout) sehingga job tidak
 * pernah jadi COMPLETED/FAILED dan indikator nyangkut selamanya.
 *
 * - Job in-process (tanpa apifyRunId) → reap setelah 20 menit (satu run VPS
 *   bisa ~15 menit + antre cooldown Shopee).
 * - Job yang sudah diserahkan ke Apify (punya apifyRunId) → 30 menit.
 */
const STALE_INPROCESS_MS = 20 * 60_000;
const STALE_APIFY_MS = 30 * 60_000;

const KEYWORD_IN_PROGRESS: KeywordIntelStatus[] = [
  KeywordIntelStatus.PENDING,
  KeywordIntelStatus.COLLECTING,
  KeywordIntelStatus.ANALYZING,
];

const USP_IN_PROGRESS: UspGapStatus[] = [
  UspGapStatus.PENDING,
  UspGapStatus.GATHERING,
  UspGapStatus.ANALYZING,
];

const TREND_IN_PROGRESS: TrendRadarStatus[] = [
  TrendRadarStatus.PENDING,
  TrendRadarStatus.COLLECTING,
  TrendRadarStatus.ANALYZING,
];

function brandHref(path: string, brandId: string | null): string {
  if (!brandId) return path;
  return `${path}?brandId=${encodeURIComponent(brandId)}`;
}

/**
 * Active Brand Hub jobs for the floating background indicator.
 * Includes scrape jobs plus in-flight AI / analysis work.
 */
export async function listActiveBrandJobs(): Promise<BrandJobSummary[]> {
  await requireBrandManager();

  const [
    scrapeJobs,
    generatingStrategies,
    generatingGuidelines,
    keywordQueries,
    uspAnalyses,
    trendDigests,
    visualCollections,
  ] = await Promise.all([
    prisma.brandResearchScrapeJob.findMany({
      where: { status: { in: ["PENDING", "RUNNING"] } },
      orderBy: { startedAt: "asc" },
      take: 20,
    }),
    prisma.brandStrategyDocument.findMany({
      where: { status: BrandStrategyStatus.GENERATING },
      select: { id: true, brandEssence: true, ownerBrandId: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: 5,
    }),
    prisma.brandCreativeGuideline.findMany({
      where: { status: BrandCreativeGuidelineStatus.GENERATING },
      select: { id: true, ownerBrandId: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: 5,
    }),
    prisma.brandKeywordQuery.findMany({
      where: { status: { in: KEYWORD_IN_PROGRESS } },
      select: { id: true, category: true, ownerBrandId: true, status: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: 5,
    }),
    prisma.brandUspAnalysis.findMany({
      where: { status: { in: USP_IN_PROGRESS } },
      select: { id: true, category: true, ownerBrandId: true, status: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: 5,
    }),
    prisma.brandTrendDigest.findMany({
      where: { status: { in: TREND_IN_PROGRESS } },
      select: {
        id: true,
        isGlobal: true,
        ownerBrandId: true,
        status: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 5,
    }),
    prisma.brandVisualCollection.findMany({
      where: { status: BrandVisualCollectionStatus.COLLECTING },
      select: { id: true, name: true, ownerBrandId: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: 5,
    }),
  ]);

  // Pisahkan job scrape yang masih hidup dari job hantu (orphaned) lalu reap
  // yang sudah lewat batas waktu — self-healing tiap kali indikator polling.
  const now = Date.now();
  const staleScrapeIds: string[] = [];
  const liveScrapeJobs = scrapeJobs.filter((job) => {
    const startedMs = (job.startedAt ?? job.createdAt).getTime();
    const limit = job.apifyRunId ? STALE_APIFY_MS : STALE_INPROCESS_MS;
    if (now - startedMs > limit) {
      staleScrapeIds.push(job.id);
      return false;
    }
    return true;
  });

  if (staleScrapeIds.length > 0) {
    await prisma.brandResearchScrapeJob.updateMany({
      where: {
        id: { in: staleScrapeIds },
        status: { in: ["PENDING", "RUNNING"] },
      },
      data: {
        status: "FAILED",
        error:
          "Proses melewati batas waktu (timeout) — ditandai gagal otomatis. Silakan refresh atau jalankan ulang.",
        completedAt: new Date(),
      },
    });
  }

  const entityIds = Array.from(new Set(liveScrapeJobs.map((j) => j.entityId)));
  const [reviewSources, competitors, collections] = await Promise.all([
    prisma.brandReviewSource.findMany({
      where: { id: { in: entityIds } },
      select: { id: true, productName: true, ownerBrandId: true },
    }),
    prisma.brandCompetitor.findMany({
      where: { id: { in: entityIds } },
      select: { id: true, name: true, ownerBrandId: true },
    }),
    prisma.brandVisualCollection.findMany({
      where: { id: { in: entityIds } },
      select: { id: true, name: true, ownerBrandId: true },
    }),
  ]);

  const reviewName = new Map(reviewSources.map((r) => [r.id, r.productName]));
  const reviewBrand = new Map(reviewSources.map((r) => [r.id, r.ownerBrandId]));
  const competitorName = new Map(competitors.map((c) => [c.id, c.name]));
  const competitorBrand = new Map(competitors.map((c) => [c.id, c.ownerBrandId]));
  const collectionName = new Map(collections.map((c) => [c.id, c.name]));
  const collectionBrand = new Map(collections.map((c) => [c.id, c.ownerBrandId]));

  const scrapeSummaries: BrandJobSummary[] = liveScrapeJobs.map((job) => {
    let label: string;
    let href: string;
    const brandId =
      reviewBrand.get(job.entityId) ??
      competitorBrand.get(job.entityId) ??
      collectionBrand.get(job.entityId) ??
      null;

    switch (job.type) {
      case ResearchScrapeJobType.REVIEW_SCRAPE:
        label = reviewName.get(job.entityId) ?? "Review source";
        href = brandHref(`/brand-hub/review-intelligence/${job.entityId}`, brandId);
        break;
      case ResearchScrapeJobType.COMPETITOR_SNAPSHOT:
        label = competitorName.get(job.entityId) ?? "Kompetitor";
        href = brandHref(`/brand-hub/competitor-tracker/${job.entityId}`, brandId);
        break;
      case ResearchScrapeJobType.PINTEREST_SCRAPE:
        label = collectionName.get(job.entityId) ?? "Pinterest scrape";
        href = brandHref("/brand-hub/visual-library", brandId);
        break;
      default:
        label = SCRAPE_TYPE_LABEL[job.type] ?? job.type;
        href = brandHref("/brand-hub", brandId);
    }

    return {
      id: job.id,
      type: job.type,
      entityId: job.entityId,
      status: job.status,
      percent: job.percent,
      stepLabel: job.stepLabel,
      startedAt: job.startedAt ? job.startedAt.toISOString() : null,
      label,
      href,
    };
  });

  const aiSummaries: BrandJobSummary[] = [
    ...generatingStrategies.map((doc) => ({
      id: `strategy-${doc.id}`,
      type: "BRAND_STRATEGY",
      entityId: doc.id,
      status: "GENERATING",
      percent: 50,
      stepLabel: "AI menyusun dokumen strategi…",
      startedAt: doc.updatedAt.toISOString(),
      label: doc.brandEssence?.trim() || "Brand Strategy",
      href: brandHref("/brand-hub/strategy", doc.ownerBrandId),
    })),
    ...generatingGuidelines.map((g) => ({
      id: `guideline-${g.id}`,
      type: "CREATIVE_GUIDELINE",
      entityId: g.id,
      status: "GENERATING",
      percent: 50,
      stepLabel: "AI menyusun creative guideline…",
      startedAt: g.updatedAt.toISOString(),
      label: "Creative Guideline",
      href: brandHref("/brand-hub/creative-guideline", g.ownerBrandId),
    })),
    ...keywordQueries.map((q) => ({
      id: `keyword-${q.id}`,
      type: "KEYWORD_INTEL",
      entityId: q.id,
      status: q.status,
      percent: q.status === "ANALYZING" ? 70 : 35,
      stepLabel: "Analisis keyword berjalan…",
      startedAt: q.updatedAt.toISOString(),
      label: q.category,
      href: brandHref(`/brand-hub/keyword-intel/${q.id}`, q.ownerBrandId),
    })),
    ...uspAnalyses.map((a) => ({
      id: `usp-${a.id}`,
      type: "USP_ANALYZER",
      entityId: a.id,
      status: a.status,
      percent: a.status === "ANALYZING" ? 75 : 40,
      stepLabel: "Analisis USP & gap berjalan…",
      startedAt: a.updatedAt.toISOString(),
      label: a.category,
      href: brandHref(`/brand-hub/usp-analyzer/${a.id}`, a.ownerBrandId),
    })),
    ...trendDigests.map((d) => ({
      id: `trend-${d.id}`,
      type: "TREND_RADAR",
      entityId: d.id,
      status: d.status,
      percent: d.status === "ANALYZING" ? 70 : 40,
      stepLabel: "Trend digest berjalan…",
      startedAt: d.updatedAt.toISOString(),
      label: d.isGlobal ? "Global Trend Digest" : "Trend Digest",
      href: brandHref(`/brand-hub/trend-radar/${d.id}`, d.ownerBrandId),
    })),
    ...visualCollections.map((c) => ({
      id: `visual-${c.id}`,
      type: "PINTEREST_SCRAPE",
      entityId: c.id,
      status: "COLLECTING",
      percent: 45,
      stepLabel: "Mengumpulkan pin Pinterest…",
      startedAt: c.updatedAt.toISOString(),
      label: c.name,
      href: brandHref("/brand-hub/visual-library", c.ownerBrandId),
    })),
  ];

  return [...scrapeSummaries, ...aiSummaries].slice(0, 12);
}

/** Lightweight status poll — avoids full page RSC refresh during generation. */
export async function getBrandStudioGenerationStatus(
  ownerBrandId?: string | null,
): Promise<{
  strategies: { id: string; status: string }[];
  guidelines: { id: string; status: string }[];
}> {
  await requireBrandManager();
  const brandFilter = brandStudioBrandFilter(ownerBrandId);

  const [strategies, guidelines] = await Promise.all([
    prisma.brandStrategyDocument.findMany({
      where: {
        ...brandFilter,
        status: { in: [BrandStrategyStatus.GENERATING, BrandStrategyStatus.DRAFT] },
      },
      select: { id: true, status: true },
      orderBy: { updatedAt: "desc" },
      take: 20,
    }),
    prisma.brandCreativeGuideline.findMany({
      where: {
        ...brandFilter,
        status: {
          in: [
            BrandCreativeGuidelineStatus.GENERATING,
            BrandCreativeGuidelineStatus.PENDING,
          ],
        },
      },
      select: { id: true, status: true },
      orderBy: { updatedAt: "desc" },
      take: 20,
    }),
  ]);

  return { strategies, guidelines };
}

/**
 * Advance waiting Apify / scrape jobs. Safe to call from UI polling —
 * does not run heavy Pinterest multi-keyword scrapes.
 */
export async function pollBrandHubBackgroundJobs(): Promise<{ polled: number }> {
  await requireBrandManager();

  let polled = await pollBrandReviewScrapeJobsLight();

  const competitorJobs = await prisma.brandResearchScrapeJob.findMany({
    where: {
      type: ResearchScrapeJobType.COMPETITOR_SNAPSHOT,
      status: ResearchScrapeJobStatus.RUNNING,
      apifyRunId: { not: null },
    },
    take: 4,
    orderBy: { createdAt: "asc" },
  });

  for (const job of competitorJobs) {
    try {
      await pollBrandCompetitorScrapeJob(job.id);
      polled += 1;
    } catch (err) {
      console.error("[pollBrandHubBackgroundJobs] competitor", job.id, err);
    }
  }

  try {
    await pollBrandAdLibraryBatchesLight();
    polled += 1;
  } catch (err) {
    console.error("[pollBrandHubBackgroundJobs] ad-library", err);
  }

  return { polled };
}
