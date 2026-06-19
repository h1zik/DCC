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
import { listBrandVisualAssets } from "@/lib/brand-research/visual";

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
  evidenceRefs: unknown[];
  aiSummary: string;
};

async function gatherStrategyEvidence(
  userId: string,
  ownerBrandId: string | null,
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

  const reviewSources = await prisma.brandReviewSource.findMany({
    where: {
      createdById: userId,
      ...(ownerBrandId ? { ownerBrandId } : {}),
      status: "READY",
    },
    include: { summary: true },
    take: 5,
  });

  const socialMonitors = await prisma.brandSocialMonitor.findMany({
    where: {
      createdById: userId,
      ...(ownerBrandId ? { ownerBrandId } : {}),
    },
    include: {
      batches: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { summary: true },
      },
    },
    take: 3,
  });

  const competitors = await prisma.brandCompetitor.findMany({
    where: {
      createdById: userId,
      ...(ownerBrandId ? { ownerBrandId } : {}),
    },
    include: { skus: { take: 8, orderBy: { reviewCount: "desc" } } },
    take: 6,
  });

  const keywordQueries = await prisma.brandKeywordQuery.findMany({
    where: {
      createdById: userId,
      ...(ownerBrandId ? { ownerBrandId } : {}),
      status: "READY",
    },
    include: { result: true },
    take: 3,
  });

  const visualAssets = await listBrandVisualAssets(userId, ownerBrandId);
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

  return {
    category,
    brandName,
    reviewInsights,
    socialInsights,
    visualTags,
    competitorCopy: competitors.map((c) => ({
      name: c.name,
      brand: c.brand,
      sampleProducts: c.skus.map((s) => s.name).slice(0, 5),
    })),
    keywordThemes,
  };
}

export async function generateBrandStrategyDocument(
  documentId: string,
  userId: string,
): Promise<void> {
  const doc = await prisma.brandStrategyDocument.findFirst({
    where: { id: documentId, createdById: userId },
  });
  if (!doc) throw new Error("Dokumen strategi tidak ditemukan.");

  await prisma.brandStrategyDocument.update({
    where: { id: documentId },
    data: { status: BrandStrategyStatus.GENERATING, errorMessage: null },
  });

  try {
    const evidence = await gatherStrategyEvidence(
      userId,
      doc.ownerBrandId,
    );
    const prompt = buildBrandStrategyPrompt(evidence);
    const result = await generateResearchJson<StrategyResult>(prompt, {
      tier: "pro",
    });

    const aiMeta = researchAiMetaFromSteps([
      buildResearchAiStep("Brand strategy synthesis", "pro"),
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

export async function getBrandStrategyDocument(documentId: string, userId: string) {
  return prisma.brandStrategyDocument.findFirst({
    where: { id: documentId, createdById: userId },
    include: { creativeGuidelines: { orderBy: { updatedAt: "desc" }, take: 1 } },
  });
}

export async function listBrandStrategyDocuments(userId: string, ownerBrandId?: string | null) {
  return prisma.brandStrategyDocument.findMany({
    where: {
      createdById: userId,
      ...(ownerBrandId ? { ownerBrandId } : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: 20,
  });
}
