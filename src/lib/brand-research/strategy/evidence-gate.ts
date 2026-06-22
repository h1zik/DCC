import "server-only";

import { isPinterestScrapeConfigured } from "@/lib/brand-research/pinterest-limits";
import { prisma } from "@/lib/prisma";
import { listBrandVisualAssets } from "@/lib/brand-research/visual";
import { brandStudioBrandFilter } from "@/lib/brand-research/brand-studio-scope";
import { countPortfolioLines } from "@/lib/brand-research/portfolio/portfolio-service";
import {
  countResearchCompetitorsActive,
  countResearchKeywordQueriesReady,
  countResearchReviewSourcesReady,
  countResearchSocialBatchesReady,
  countResearchTrendDigestsReady,
  countResearchUspAnalysesReady,
} from "@/lib/brand-research/research-hub-readers";
import type {
  DemoFlag,
  EvidenceCheck,
  EvidenceReadiness,
  EvidenceWarning,
} from "@/lib/brand-research/strategy/evidence-types";

const MIN_VISUAL_ASSETS = 5;

function brandFilter(ownerBrandId?: string | null) {
  return brandStudioBrandFilter(ownerBrandId);
}

async function detectDemoFlags(
  _userId: string,
  ownerBrandId?: string | null,
): Promise<DemoFlag[]> {
  const flags: DemoFlag[] = [];

  if (!isPinterestScrapeConfigured()) {
    flags.push({
      module: "visual-library",
      label: "Visual Library (Pinterest)",
      detail:
        "SCRAPER_API_URL / APIFY belum diset — scrape Pinterest memakai data demo.",
    });
  } else {
    const demoAssets = await prisma.brandVisualAsset.count({
      where: {
        source: "PINTEREST",
        collection: brandFilter(ownerBrandId),
        metadata: { path: ["demo"], equals: true },
      },
    });
    if (demoAssets > 0) {
      flags.push({
        module: "visual-library",
        label: "Visual Library (Pinterest)",
        detail: `${demoAssets} asset Pinterest berasal dari data demo.`,
      });
    }
  }

  const socialBatches = await prisma.socialListeningBatch.findMany({
    where: { status: "READY" },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { errorMessage: true, summary: { select: { aiSummary: true } } },
  });
  for (const b of socialBatches) {
    const msg = `${b.errorMessage ?? ""} ${b.summary?.aiSummary ?? ""}`.toLowerCase();
    if (msg.includes("demo")) {
      flags.push({
        module: "social-listening",
        label: "Social Listening",
        detail: "Batch sosial memakai atau mencatat data demo.",
      });
      break;
    }
  }

  const trendDigests = await prisma.trendRadarDigest.findMany({
    where: { status: "READY" },
    orderBy: { createdAt: "desc" },
    take: 3,
    select: { narrative: true },
  });
  for (const d of trendDigests) {
    if (d.narrative?.toLowerCase().includes("demo")) {
      flags.push({
        module: "research-trend",
        label: "Trend Radar (Research Hub)",
        detail: "Digest tren memakai data demo.",
      });
      break;
    }
  }

  return flags;
}

export async function assessBrandEvidenceReadiness(
  userId: string,
  ownerBrandId?: string | null,
): Promise<EvidenceReadiness> {
  const [
    reviewReady,
    socialReady,
    visualAssets,
    competitorWithSkus,
    trendReady,
    uspReady,
    keywordReady,
    portfolioLines,
    demoFlags,
  ] = await Promise.all([
    countResearchReviewSourcesReady(),
    countResearchSocialBatchesReady(),
    listBrandVisualAssets(userId, ownerBrandId),
    countResearchCompetitorsActive(),
    countResearchTrendDigestsReady(),
    countResearchUspAnalysesReady(),
    countResearchKeywordQueriesReady(),
    ownerBrandId ? countPortfolioLines(ownerBrandId) : Promise.resolve(0),
    detectDemoFlags(userId, ownerBrandId),
  ]);

  const visualCount = visualAssets.length;
  const hasVoiceOfCustomer = reviewReady >= 1 || socialReady >= 1;
  const hasVisualOrCompetitor =
    visualCount >= MIN_VISUAL_ASSETS || competitorWithSkus >= 1;

  const brandQs = ownerBrandId ? `?brandId=${encodeURIComponent(ownerBrandId)}` : "";

  const hasPortfolio = !ownerBrandId || portfolioLines >= 1;

  const checks: EvidenceCheck[] = [
    {
      key: "brand-portfolio",
      label: "Brand Portfolio (≥1 lini produk)",
      met: hasPortfolio,
      count: portfolioLines,
      required: !!ownerBrandId,
      href: `/brand-hub/portfolio${brandQs}`,
      detail:
        portfolioLines > 0
          ? `${portfolioLines} lini produk terdefinisi`
          : "Definisikan produk yang akan dijual sebelum generate strategi",
    },
    {
      key: "voice-of-customer",
      label: "Review Intel atau Social Listening siap",
      met: hasVoiceOfCustomer,
      count: reviewReady + socialReady,
      required: true,
      href: `/brand-hub/strategy${brandQs}`,
      detail: `${reviewReady} review (Research Hub) · ${socialReady} batch sosial`,
    },
    {
      key: "visual-or-competitor",
      label: `Visual Library (≥${MIN_VISUAL_ASSETS} asset) atau Competitor dengan SKU`,
      met: hasVisualOrCompetitor,
      count: visualCount,
      required: true,
      href: `/brand-hub/visual-library${brandQs}`,
      detail: `${visualCount} asset · ${competitorWithSkus} kompetitor aktif`,
    },
  ];

  const warnings: EvidenceWarning[] = [];
  if (trendReady === 0) {
    warnings.push({
      key: "trend-radar",
      label: "Trend Radar belum siap",
      href: `/brand-hub/visual-trend${brandQs}`,
      detail: "Tambahkan digest tren di Research Hub (Market Analyst).",
    });
  }
  if (uspReady === 0) {
    warnings.push({
      key: "usp-analyzer",
      label: "USP Analyzer belum siap",
      href: `/brand-hub/strategy${brandQs}`,
      detail: "Jalankan USP Analyzer di Research Hub.",
    });
  }
  if (keywordReady === 0) {
    warnings.push({
      key: "keyword-intel",
      label: "Keyword Intel belum siap",
      href: `/brand-hub/keyword-intel${brandQs}`,
      detail: "Buat analisis keyword di Brand Hub Keyword Intel.",
    });
  }

  const canGenerate = checks.filter((c) => c.required).every((c) => c.met);

  return { canGenerate, checks, warnings, demoFlags };
}

export function formatEvidenceGateError(readiness: EvidenceReadiness): string {
  const failed = readiness.checks.filter((c) => c.required && !c.met);
  if (failed.length === 0) return "Evidence belum memenuhi syarat generate.";
  return `Evidence belum cukup: ${failed.map((c) => c.label).join("; ")}.`;
}

const MIN_GUIDELINE_VISUAL_ASSETS = 5;

export type GuidelineReadiness = {
  canGenerate: boolean;
  strategyReady: boolean;
  visualAssetCount: number;
  message?: string;
};

export async function assessCreativeGuidelineReadiness(
  userId: string,
  ownerBrandId: string | null | undefined,
  strategyDocumentId: string | null | undefined,
): Promise<GuidelineReadiness> {
  if (!strategyDocumentId) {
    return {
      canGenerate: false,
      strategyReady: false,
      visualAssetCount: 0,
      message: "Pilih dokumen Brand Strategy yang status READY.",
    };
  }

  const strategy = await prisma.brandStrategyDocument.findFirst({
    where: {
      id: strategyDocumentId,
      status: "READY",
    },
  });

  if (!strategy) {
    return {
      canGenerate: false,
      strategyReady: false,
      visualAssetCount: 0,
      message: "Brand Strategy belum READY — generate atau simpan strategi dulu.",
    };
  }

  const assets = await listBrandVisualAssets(userId, ownerBrandId ?? strategy.ownerBrandId);
  const visualAssetCount = assets.length;

  if (visualAssetCount < MIN_GUIDELINE_VISUAL_ASSETS) {
    return {
      canGenerate: false,
      strategyReady: true,
      visualAssetCount,
      message: `Visual Library butuh minimal ${MIN_GUIDELINE_VISUAL_ASSETS} asset (saat ini ${visualAssetCount}).`,
    };
  }

  return { canGenerate: true, strategyReady: true, visualAssetCount };
}
