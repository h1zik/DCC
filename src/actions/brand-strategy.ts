"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { BrandStrategyStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireBrandManager } from "@/lib/brand-research/auth";
import {
  assessBrandEvidenceReadiness,
  formatEvidenceGateError,
} from "@/lib/brand-research/strategy/evidence-gate";
import {
  generateBrandStrategyDocument,
  getBrandStrategyDocument,
  listBrandStrategyDocuments,
  regenerateBrandStrategySection,
} from "@/lib/brand-research/strategy/strategy-generator";
import type { StrategySectionField } from "@/lib/brand-research/strategy/evidence-types";
import {
  defaultStrategyGenerationConfig,
  getStrategySourceCatalog,
  validateStrategyGenerationConfig,
} from "@/lib/brand-research/strategy/strategy-source-catalog";
import type { StrategyGenerationConfig } from "@/lib/brand-research/strategy/evidence-types";
import { buildBrandStrategyPdfHtml } from "@/lib/brand-research/strategy/strategy-pdf-html";

const generationConfigSchema = z.object({
  review: z.object({ enabled: z.boolean(), ids: z.array(z.string()) }),
  social: z.object({ enabled: z.boolean(), ids: z.array(z.string()) }),
  visual: z.object({
    enabled: z.boolean(),
    ids: z.array(z.string()),
    analyzeImages: z.boolean(),
    maxSamples: z.number().int().min(1).max(16),
  }),
  competitor: z.object({ enabled: z.boolean(), ids: z.array(z.string()) }),
  keyword: z.object({ enabled: z.boolean(), ids: z.array(z.string()) }),
  trend: z.object({ enabled: z.boolean(), ids: z.array(z.string()) }),
  usp: z.object({ enabled: z.boolean(), ids: z.array(z.string()) }),
  productDiscovery: z.object({ enabled: z.boolean(), ids: z.array(z.string()) }),
});

const createSchema = z.object({
  ownerBrandId: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  pmBrief: z.string().optional().nullable(),
  generationConfig: generationConfigSchema.optional(),
});

const updateSchema = z.object({
  documentId: z.string().min(1),
  brandPurpose: z.string().optional(),
  brandEssence: z.string().optional(),
  coreMessage: z.string().optional(),
  brandUsp: z.string().optional(),
  stp: z
    .object({
      segment: z.string(),
      targeting: z.string(),
      positioningStatement: z.string(),
    })
    .optional(),
  brandPersonality: z
    .object({
      archetype: z.string(),
      traits: z.array(z.string()),
      antiTraits: z.array(z.string()),
    })
    .optional(),
  toneOfVoice: z
    .object({
      principles: z.array(z.string()),
      doExamples: z.array(z.string()),
      dontExamples: z.array(z.string()),
    })
    .optional(),
});

export async function createBrandStrategyDocument(
  input: z.infer<typeof createSchema>,
) {
  const session = await requireBrandManager();
  const data = createSchema.parse(input);

  const readiness = await assessBrandEvidenceReadiness(
    session.user.id,
    data.ownerBrandId ?? null,
  );
  if (!readiness.canGenerate) {
    throw new Error(formatEvidenceGateError(readiness));
  }

  const catalog = await getStrategySourceCatalog(
    session.user.id,
    data.ownerBrandId ?? null,
  );
  const genConfig =
    data.generationConfig ?? defaultStrategyGenerationConfig(catalog);
  const validation = validateStrategyGenerationConfig(genConfig, catalog);
  if (!validation.ok) {
    throw new Error(validation.message ?? "Konfigurasi sumber tidak valid.");
  }

  const doc = await prisma.brandStrategyDocument.create({
    data: {
      ownerBrandId: data.ownerBrandId ?? null,
      category: data.category?.trim() || null,
      pmBrief: data.pmBrief?.trim() || null,
      status: BrandStrategyStatus.DRAFT,
      createdById: session.user.id,
      generationConfig: genConfig as object,
    },
  });

  after(async () => {
    try {
      await generateBrandStrategyDocument(doc.id, session.user.id, genConfig);
    } catch (err) {
      console.error("[createBrandStrategyDocument]", err);
    }
  });

  revalidatePath("/brand-hub/strategy");
  return { id: doc.id };
}

export async function regenerateBrandStrategyDocument(
  documentId: string,
  generationConfig?: StrategyGenerationConfig,
) {
  const session = await requireBrandManager();
  z.string().min(1).parse(documentId);

  const doc = await prisma.brandStrategyDocument.findFirst({
    where: { id: documentId },
    select: { ownerBrandId: true, generationConfig: true },
  });
  if (!doc) throw new Error("Dokumen strategi tidak ditemukan.");

  const readiness = await assessBrandEvidenceReadiness(
    session.user.id,
    doc.ownerBrandId,
  );
  if (!readiness.canGenerate) {
    throw new Error(formatEvidenceGateError(readiness));
  }

  const catalog = await getStrategySourceCatalog(session.user.id, doc.ownerBrandId);
  const config =
    generationConfig ??
    (doc.generationConfig as StrategyGenerationConfig | null) ??
    defaultStrategyGenerationConfig(catalog);

  const validation = validateStrategyGenerationConfig(config, catalog);
  if (!validation.ok) {
    throw new Error(validation.message ?? "Konfigurasi sumber tidak valid.");
  }

  after(async () => {
    try {
      await generateBrandStrategyDocument(documentId, session.user.id, config);
    } catch (err) {
      console.error("[regenerateBrandStrategyDocument]", err);
    }
  });

  revalidatePath("/brand-hub/strategy");
}

export async function updateBrandStrategyDocument(
  input: z.infer<typeof updateSchema>,
) {
  const session = await requireBrandManager();
  const data = updateSchema.parse(input);

  await prisma.brandStrategyDocument.updateMany({
    where: { id: data.documentId },
    data: {
      ...(data.brandPurpose !== undefined ? { brandPurpose: data.brandPurpose } : {}),
      ...(data.brandEssence !== undefined ? { brandEssence: data.brandEssence } : {}),
      ...(data.coreMessage !== undefined ? { coreMessage: data.coreMessage } : {}),
      ...(data.brandUsp !== undefined ? { brandUsp: data.brandUsp } : {}),
      ...(data.stp ? { stp: data.stp as object } : {}),
      ...(data.brandPersonality
        ? { brandPersonality: data.brandPersonality as object }
        : {}),
      ...(data.toneOfVoice ? { toneOfVoice: data.toneOfVoice as object } : {}),
      status: BrandStrategyStatus.READY,
    },
  });

  revalidatePath("/brand-hub/strategy");
}

export async function deleteBrandStrategyDocument(documentId: string) {
  const session = await requireBrandManager();
  await prisma.brandStrategyDocument.deleteMany({
    where: { id: documentId },
  });
  revalidatePath("/brand-hub/strategy");
}

export async function regenerateBrandStrategySectionAction(
  documentId: string,
  field: StrategySectionField,
) {
  const session = await requireBrandManager();
  z.string().min(1).parse(documentId);

  const doc = await prisma.brandStrategyDocument.findFirst({
    where: { id: documentId },
    select: { ownerBrandId: true },
  });
  if (!doc) throw new Error("Dokumen strategi tidak ditemukan.");

  after(async () => {
    try {
      await regenerateBrandStrategySection(documentId, session.user.id, field);
    } catch (err) {
      console.error("[regenerateBrandStrategySection]", err);
    }
  });

  revalidatePath("/brand-hub/strategy");
}

export async function getBrandStrategyPageData(ownerBrandId?: string | null) {
  const session = await requireBrandManager();
  const [documents, evidenceReadiness, sourceCatalog] = await Promise.all([
    listBrandStrategyDocuments(session.user.id, ownerBrandId),
    assessBrandEvidenceReadiness(session.user.id, ownerBrandId ?? null),
    getStrategySourceCatalog(session.user.id, ownerBrandId ?? null),
  ]);
  return {
    evidenceReadiness,
    sourceCatalog,
    defaultGenerationConfig: defaultStrategyGenerationConfig(sourceCatalog),
    documents: documents.map((d) => ({
      id: d.id,
      status: d.status,
      version: d.version,
      ownerBrandId: d.ownerBrandId,
      category: d.category,
      pmBrief: d.pmBrief,
      brandPurpose: d.brandPurpose,
      brandEssence: d.brandEssence,
      coreMessage: d.coreMessage,
      brandUsp: d.brandUsp,
      stp: d.stp,
      brandPersonality: d.brandPersonality,
      toneOfVoice: d.toneOfVoice,
      strategicTensions: d.strategicTensions,
      productLineStrategy: d.productLineStrategy,
      insightMemo: d.insightMemo,
      actionPlan: d.actionPlan,
      citationQuality: d.citationQuality,
      evidenceRefs: d.evidenceRefs,
      strategyRationales: d.strategyRationales,
      generationConfig: d.generationConfig,
      evidenceSnapshot: d.evidenceSnapshot,
      errorMessage: d.errorMessage,
      updatedAt: d.updatedAt.toISOString(),
    })),
  };
}

export async function exportBrandStrategyPdfHtml(documentId: string) {
  const session = await requireBrandManager();
  const doc = await getBrandStrategyDocument(documentId, session.user.id);
  if (!doc) throw new Error("Dokumen tidak ditemukan.");

  const brandName = doc.ownerBrandId
    ? (
        await prisma.brand.findUnique({
          where: { id: doc.ownerBrandId },
          select: { name: true },
        })
      )?.name
    : "Brand";

  return buildBrandStrategyPdfHtml({
    brandName: brandName ?? "Brand",
    document: doc,
  });
}
