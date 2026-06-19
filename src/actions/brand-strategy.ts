"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { BrandStrategyStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireBrandManager } from "@/lib/brand-research/auth";
import {
  generateBrandStrategyDocument,
  getBrandStrategyDocument,
  listBrandStrategyDocuments,
} from "@/lib/brand-research/strategy/strategy-generator";
import { buildBrandStrategyPdfHtml } from "@/lib/brand-research/strategy/strategy-pdf-html";

const createSchema = z.object({
  ownerBrandId: z.string().optional().nullable(),
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

  const doc = await prisma.brandStrategyDocument.create({
    data: {
      ownerBrandId: data.ownerBrandId ?? null,
      status: BrandStrategyStatus.DRAFT,
      createdById: session.user.id,
    },
  });

  after(async () => {
    try {
      await generateBrandStrategyDocument(doc.id, session.user.id);
    } catch (err) {
      console.error("[createBrandStrategyDocument]", err);
    }
  });

  revalidatePath("/brand-hub/strategy");
  return { id: doc.id };
}

export async function regenerateBrandStrategyDocument(documentId: string) {
  const session = await requireBrandManager();
  z.string().min(1).parse(documentId);

  after(async () => {
    try {
      await generateBrandStrategyDocument(documentId, session.user.id);
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
    where: { id: data.documentId, createdById: session.user.id },
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
    where: { id: documentId, createdById: session.user.id },
  });
  revalidatePath("/brand-hub/strategy");
}

export async function getBrandStrategyPageData(ownerBrandId?: string | null) {
  const session = await requireBrandManager();
  const documents = await listBrandStrategyDocuments(
    session.user.id,
    ownerBrandId,
  );
  return {
    documents: documents.map((d) => ({
      id: d.id,
      status: d.status,
      ownerBrandId: d.ownerBrandId,
      brandPurpose: d.brandPurpose,
      brandEssence: d.brandEssence,
      coreMessage: d.coreMessage,
      brandUsp: d.brandUsp,
      stp: d.stp,
      brandPersonality: d.brandPersonality,
      toneOfVoice: d.toneOfVoice,
      evidenceRefs: d.evidenceRefs,
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
