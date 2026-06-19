import "server-only";

import { BrandStrategyStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateResearchJson } from "@/lib/research/gemini-client";
import {
  buildResearchAiStep,
  researchAiMetaFromSteps,
} from "@/lib/research/llm";
import {
  buildBrandStrategyPrompt,
  type BrandStrategyEvidenceInput,
} from "@/lib/brand-research/strategy/prompts/brand-strategy";
import { assessBrandEvidenceReadiness } from "@/lib/brand-research/strategy/evidence-gate";
import type {
  EvidenceSnapshot,
  StrategyFieldRationale,
  StrategyGenerationConfig,
  StructuredSourceRef,
} from "@/lib/brand-research/strategy/evidence-types";
import {
  defaultStrategyGenerationConfig,
  getStrategySourceCatalog,
} from "@/lib/brand-research/strategy/strategy-source-catalog";
import { filterBrandVisualAssetsForStrategy } from "@/lib/brand-research/strategy/strategy-visual-filter";
import {
  buildVisualSourceRefs,
  type StrategyVisualCatalog,
} from "@/lib/brand-research/strategy/strategy-visual-config";
import {
  loadVisualImageParts,
  sampleVisualAssetsForVision,
} from "@/lib/brand-research/strategy/visual-vision";
import { listBrandVisualAssets } from "@/lib/brand-research/visual";
import { brandStudioBrandFilter } from "@/lib/brand-research/brand-studio-scope";
import { resolveResearchProvider } from "@/lib/research/llm/config";

type StrategyResult = {
  brandPurpose: string;
  brandEssence: string;
  coreMessage: string;
  brandUsp: string;
  stp: { segment: string; targeting: string; positioningStatement: string };
  brandPersonality: {
    archetype: string;
    traits: string[];
    antiTraits: string[];
  };
  toneOfVoice: {
    principles: string[];
    doExamples: string[];
    dontExamples: string[];
  };
  strategyRationales?: StrategyFieldRationale[];
  evidenceRefs: unknown[];
  aiSummary: string;
};

function idFilter(ids: string[]) {
  return ids.length > 0 ? { id: { in: ids } } : {};
}

export async function gatherStrategyEvidence(
  userId: string,
  ownerBrandId: string | null,
  config: StrategyGenerationConfig,
  visualCatalog: StrategyVisualCatalog,
  category?: string,
): Promise<BrandStrategyEvidenceInput> {
  const brandName = ownerBrandId
    ? (
        await prisma.brand.findUnique({
          where: { id: ownerBrandId },
          select: { name: true },
        })
      )?.name
    : undefined;

  const brandQs = ownerBrandId
    ? `?brandId=${encodeURIComponent(ownerBrandId)}`
    : "";

  const sourceRefs: StructuredSourceRef[] = [];

  const reviewSources = config.review.enabled
    ? await prisma.reviewIntelSource.findMany({
        where: {
          status: "READY",
          ...idFilter(config.review.ids),
        },
        include: { summary: true },
        take: 10,
      })
    : [];

  for (const s of reviewSources) {
    sourceRefs.push({
      module: "review-intelligence",
      sourceId: s.id,
      label: `${s.productName} (${s.competitorBrand})`,
      href: `/brand-hub/strategy${brandQs}`,
    });
  }

  const socialMonitors = config.social.enabled
    ? await prisma.socialListeningMonitor.findMany({
        where: {
          ...idFilter(config.social.ids),
        },
        include: {
          batches: {
            where: { status: "READY" },
            orderBy: { createdAt: "desc" },
            take: 1,
            include: { summary: true },
          },
        },
        take: 10,
      })
    : [];

  for (const m of socialMonitors) {
    if (m.batches[0]) {
      sourceRefs.push({
        module: "social-listening",
        sourceId: m.id,
        label: m.name,
        href: `/brand-hub/social-listening/${m.id}${brandQs}`,
      });
    }
  }

  const competitors = config.competitor.enabled
    ? await prisma.researchCompetitor.findMany({
        where: {
          ...idFilter(config.competitor.ids),
        },
        include: {
          skus: {
            take: 8,
            orderBy: { reviewCount: "desc" },
            include: {
              snapshots: {
                orderBy: { capturedAt: "desc" },
                take: 1,
                select: { promoText: true, rating: true },
              },
            },
          },
        },
        take: 10,
      })
    : [];

  for (const c of competitors) {
    sourceRefs.push({
      module: "competitor-tracker",
      sourceId: c.id,
      label: `${c.brand} — ${c.name}`,
      href: `/brand-hub/competitor-tracker/${c.id}${brandQs}`,
    });
  }

  const keywordQueries = config.keyword.enabled
    ? await prisma.keywordIntelQuery.findMany({
        where: {
          status: "READY",
          ...idFilter(config.keyword.ids),
        },
        include: { result: true },
        take: 10,
      })
    : [];

  for (const q of keywordQueries) {
    sourceRefs.push({
      module: "keyword-intel",
      sourceId: q.id,
      label: q.seedKeyword ?? q.category,
      href: `/brand-hub/strategy${brandQs}`,
    });
  }

  const trendDigest = config.trend.enabled
    ? await prisma.trendRadarDigest.findFirst({
        where: {
          status: "READY",
          ...idFilter(config.trend.ids),
        },
        orderBy: { createdAt: "desc" },
        include: {
          items: { orderBy: { score: "desc" }, take: 10 },
        },
      })
    : null;

  if (trendDigest) {
    sourceRefs.push({
      module: "trend-radar",
      sourceId: trendDigest.id,
      label: trendDigest.isGlobal ? "Digest global" : "Digest brand",
      href: `/brand-hub/visual-trend${brandQs}`,
    });
  }

  const uspAnalysis = config.usp.enabled
    ? await prisma.uspGapAnalysis.findFirst({
        where: {
          status: "READY",
          ...idFilter(config.usp.ids),
        },
        orderBy: { updatedAt: "desc" },
        include: { result: true },
      })
    : null;

  if (uspAnalysis) {
    sourceRefs.push({
      module: "usp-analyzer",
      sourceId: uspAnalysis.id,
      label: uspAnalysis.category,
      href: `/brand-hub/strategy${brandQs}`,
    });
  }

  const visualAssets = config.visual.enabled
    ? filterBrandVisualAssetsForStrategy(
        await listBrandVisualAssets(userId, ownerBrandId),
        config.visual,
      )
    : [];
  if (visualAssets.length > 0) {
    sourceRefs.push(...buildVisualSourceRefs(config.visual, visualCatalog, brandQs));
  }

  const visualTags = [
    ...new Set(
      visualAssets.flatMap((a) => [
        ...a.tags,
        ...a.aestheticTags,
        a.title ?? "",
      ]),
    ),
  ]
    .filter(Boolean)
    .slice(0, 40);

  const reviewInsights = reviewSources.map((s) => {
    const complaints = Array.isArray(s.summary?.topComplaints)
      ? (s.summary!.topComplaints as { theme: string }[]).map((c) => c.theme)
      : [];
    const praises = Array.isArray(s.summary?.topPraises)
      ? (s.summary!.topPraises as { theme: string }[]).map((p) => p.theme)
      : [];
    return {
      sourceId: s.id,
      productName: s.productName,
      competitorBrand: s.competitorBrand,
      positivePct: s.summary?.positivePct ?? 0,
      negativePct: s.summary?.negativePct ?? 0,
      topComplaints: complaints.slice(0, 5),
      topPraises: praises.slice(0, 5),
      gapOpportunity: s.summary?.gapOpportunity ?? null,
    };
  });

  const socialInsights = socialMonitors
    .map((m) => {
      const summary = m.batches[0]?.summary;
      if (!summary) return null;
      const pains = Array.isArray(summary.topPainPoints)
        ? (summary.topPainPoints as { theme: string }[]).map((p) => p.theme)
        : [];
      const wish = Array.isArray(summary.topWishlist)
        ? (summary.topWishlist as { theme: string }[]).map((w) => w.theme)
        : [];
      return {
        sourceId: m.id,
        name: m.name,
        topPainPoints: pains.slice(0, 5),
        topWishlist: wish.slice(0, 5),
        aiSummary: summary.aiSummary,
      };
    })
    .filter(Boolean) as BrandStrategyEvidenceInput["socialInsights"];

  const keywordThemes = keywordQueries.flatMap((q) => {
    const matrix = Array.isArray(q.result?.keywordMatrix)
      ? (q.result!.keywordMatrix as { keyword: string }[])
      : [];
    return matrix.slice(0, 10).map((k) => k.keyword);
  });

  const trendSignals =
    trendDigest?.items.map((i) => ({
      sourceId: trendDigest.id,
      name: i.name,
      phase: i.phase,
      dimension: i.dimension,
      narrative: i.narrative,
    })) ?? [];

  let uspInsights: BrandStrategyEvidenceInput["uspInsights"] = null;
  if (uspAnalysis?.result) {
    const claimAnalysis = uspAnalysis.result.claimAnalysis as
      | { overused?: string[]; underserved?: string[] }
      | null;
    const candidates = Array.isArray(uspAnalysis.result.uspCandidates)
      ? (uspAnalysis.result.uspCandidates as { usp?: string }[])
          .map((c) => c.usp ?? "")
          .filter(Boolean)
          .slice(0, 5)
      : [];
    uspInsights = {
      sourceId: uspAnalysis.id,
      category: uspAnalysis.category,
      uspCandidates: candidates,
      overusedClaims: claimAnalysis?.overused ?? [],
      underservedClaims: claimAnalysis?.underserved ?? [],
      aiSummary: uspAnalysis.result.aiSummary,
    };
  }

  return {
    category,
    brandName,
    sourceRefs,
    reviewInsights,
    socialInsights,
    visualTags,
    visualAssetCount: visualAssets.length,
    visualImageAnalysis: undefined,
    competitorCopy: competitors.map((c) => ({
      sourceId: c.id,
      name: c.name,
      brand: c.brand,
      sampleProducts: c.skus.slice(0, 5).map((s) => ({
        name: s.name,
        rating: s.rating ?? s.snapshots[0]?.rating ?? null,
        promoText: s.snapshots[0]?.promoText ?? null,
      })),
    })),
    keywordThemes,
    trendSignals,
    uspInsights,
  };
}

export async function generateBrandStrategyDocument(
  documentId: string,
  userId: string,
  generationConfig?: StrategyGenerationConfig,
): Promise<void> {
  const doc = await prisma.brandStrategyDocument.findFirst({
    where: { id: documentId },
  });
  if (!doc) throw new Error("Dokumen strategi tidak ditemukan.");

  const catalog = await getStrategySourceCatalog(userId, doc.ownerBrandId);
  const config =
    generationConfig ?? defaultStrategyGenerationConfig(catalog);

  await prisma.brandStrategyDocument.update({
    where: { id: documentId },
    data: {
      status: BrandStrategyStatus.GENERATING,
      errorMessage: null,
      generationConfig: config as object,
    },
  });

  try {
    const readiness = await assessBrandEvidenceReadiness(userId, doc.ownerBrandId);
    const evidence = await gatherStrategyEvidence(
      userId,
      doc.ownerBrandId,
      config,
      catalog.visual,
    );

    const visualAssets = config.visual.enabled
      ? filterBrandVisualAssetsForStrategy(
          await listBrandVisualAssets(userId, doc.ownerBrandId),
          config.visual,
        )
      : [];

    let imageParts: { mimeType: string; data: string; label?: string }[] = [];
    const useVision =
      config.visual.enabled &&
      config.visual.analyzeImages &&
      resolveResearchProvider() === "gemini" &&
      visualAssets.length > 0;

    if (useVision) {
      const sampled = sampleVisualAssetsForVision(
        visualAssets.map((a) => ({
          id: a.id,
          imageUrl: a.imageUrl,
          thumbnailUrl: a.thumbnailUrl,
          title: a.title,
          tags: a.tags,
          collectionId: a.collectionId,
        })),
        Math.min(config.visual.maxSamples ?? 12, 16),
      );
      const loaded = await loadVisualImageParts(sampled);
      imageParts = loaded.parts;
      evidence.visualImageAnalysis = {
        enabled: true,
        sampleCount: sampled.length,
        loadedCount: loaded.loadedCount,
        sampleLabels: loaded.parts.map((p) => p.label ?? "visual"),
      };
    } else if (config.visual.enabled && visualAssets.length > 0) {
      evidence.visualImageAnalysis = {
        enabled: false,
        sampleCount: 0,
        loadedCount: 0,
        sampleLabels: [],
      };
    }

    const snapshot: EvidenceSnapshot = {
      gatheredAt: new Date().toISOString(),
      ownerBrandId: doc.ownerBrandId,
      readiness,
      sourceRefs: evidence.sourceRefs,
      input: {
        generationConfig: config,
        category: evidence.category,
        brandName: evidence.brandName,
        reviewInsights: evidence.reviewInsights,
        socialInsights: evidence.socialInsights,
        visualTags: evidence.visualTags,
        visualAssetCount: evidence.visualAssetCount,
        visualImageAnalysis: evidence.visualImageAnalysis,
        competitorCopy: evidence.competitorCopy,
        keywordThemes: evidence.keywordThemes,
        trendSignals: evidence.trendSignals,
        uspInsights: evidence.uspInsights,
      },
    };

    const prompt = buildBrandStrategyPrompt(evidence);
    const result = await generateResearchJson<StrategyResult>(prompt, {
      tier: "pro",
      imageParts: imageParts.length > 0 ? imageParts : undefined,
    });

    const rationales = (result.strategyRationales ?? []).filter(
      (r) => r?.field && r?.reasoning,
    ) as StrategyFieldRationale[];

    const aiMeta = researchAiMetaFromSteps([
      buildResearchAiStep(
        imageParts.length > 0
          ? `Brand strategy synthesis (+${imageParts.length} visual images)`
          : "Brand strategy synthesis",
        "pro",
      ),
    ]);

    await prisma.brandStrategyDocument.update({
      where: { id: documentId },
      data: {
        status: BrandStrategyStatus.READY,
        brandPurpose: result.brandPurpose,
        brandEssence: result.brandEssence,
        coreMessage: result.coreMessage,
        brandUsp: result.brandUsp,
        stp: result.stp as object,
        brandPersonality: result.brandPersonality as object,
        toneOfVoice: result.toneOfVoice as object,
        evidenceRefs: (result.evidenceRefs ?? []) as object,
        strategyRationales: rationales as object,
        evidenceSnapshot: snapshot as object,
        generationConfig: config as object,
        aiMeta: aiMeta as object,
        errorMessage: null,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Generasi strategi gagal.";
    await prisma.brandStrategyDocument.update({
      where: { id: documentId },
      data: { status: BrandStrategyStatus.FAILED, errorMessage: message },
    });
    throw err;
  }
}

export async function getBrandStrategyDocument(documentId: string, _userId: string) {
  return prisma.brandStrategyDocument.findFirst({
    where: { id: documentId },
    include: { creativeGuidelines: { orderBy: { updatedAt: "desc" }, take: 1 } },
  });
}

export async function listBrandStrategyDocuments(
  _userId: string,
  ownerBrandId?: string | null,
) {
  return prisma.brandStrategyDocument.findMany({
    where: brandStudioBrandFilter(ownerBrandId),
    orderBy: { updatedAt: "desc" },
    take: 20,
  });
}
