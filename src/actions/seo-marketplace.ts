"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { ResearchMarketplace } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSeoAccess } from "@/lib/seo/auth";
import {
  enqueueMarketplaceAnalysis,
  MARKETPLACE_SEO_SUPPORTED,
} from "@/lib/seo/marketplace/analyzer";

const createSchema = z.object({
  keyword: z.string().min(1).max(200),
  marketplace: z.nativeEnum(ResearchMarketplace).refine(
    (m) => MARKETPLACE_SEO_SUPPORTED.includes(m),
    { message: "Marketplace tidak didukung." },
  ),
  ownTitle: z.string().max(300).optional(),
});

export async function createSeoMarketplaceAnalysis(
  input: z.infer<typeof createSchema>,
) {
  const session = await requireSeoAccess();
  const data = createSchema.parse(input);

  const analysis = await prisma.seoMarketplaceAnalysis.create({
    data: {
      keyword: data.keyword.trim(),
      marketplace: data.marketplace,
      ownTitle: data.ownTitle?.trim() || null,
      createdById: session.user.id,
    },
  });

  after(async () => {
    try {
      await enqueueMarketplaceAnalysis(analysis.id);
    } catch (err) {
      console.error("[createSeoMarketplaceAnalysis] gagal", err);
    }
  });

  revalidatePath("/seo/marketplace");
  revalidatePath(`/seo/marketplace/${analysis.id}`);
  return { id: analysis.id };
}

export async function refreshSeoMarketplaceAnalysis(analysisId: string) {
  await requireSeoAccess();
  z.string().min(1).parse(analysisId);

  const existing = await prisma.seoMarketplaceAnalysis.findUnique({
    where: { id: analysisId },
    select: { id: true },
  });
  if (!existing) throw new Error("Analisis tidak ditemukan.");

  await prisma.seoMarketplaceAnalysis.update({
    where: { id: analysisId },
    data: { status: "PENDING", errorMessage: null, dataNotice: null },
  });

  after(async () => {
    try {
      await enqueueMarketplaceAnalysis(analysisId);
    } catch (err) {
      console.error("[refreshSeoMarketplaceAnalysis] gagal", err);
    }
  });

  revalidatePath("/seo/marketplace");
  revalidatePath(`/seo/marketplace/${analysisId}`);
}

export async function deleteSeoMarketplaceAnalysis(analysisId: string) {
  await requireSeoAccess();
  z.string().min(1).parse(analysisId);

  await prisma.seoMarketplaceAnalysis.delete({ where: { id: analysisId } });
  revalidatePath("/seo/marketplace");
}
