"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { ResearchMarketplace } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSeoAccess } from "@/lib/seo/auth";
import { enqueueKeywordResearch } from "@/lib/seo/keyword-research/analyzer";

const createSchema = z.object({
  name: z.string().min(1).max(120),
  seedKeyword: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  marketplace: z.nativeEnum(ResearchMarketplace).optional(),
  locationCode: z.number().int().positive().optional(),
  languageCode: z.string().min(2).max(8).optional(),
});

export async function createSeoKeywordProject(
  input: z.infer<typeof createSchema>,
) {
  const session = await requireSeoAccess();
  const data = createSchema.parse(input);

  const project = await prisma.seoKeywordProject.create({
    data: {
      name: data.name.trim(),
      seedKeyword: data.seedKeyword.trim(),
      description: data.description?.trim() || null,
      marketplace: data.marketplace ?? null,
      locationCode: data.locationCode ?? 2360,
      languageCode: data.languageCode?.trim() || "id",
      createdById: session.user.id,
    },
  });

  after(async () => {
    try {
      await enqueueKeywordResearch(project.id);
    } catch (err) {
      console.error("[createSeoKeywordProject] riset gagal", err);
    }
  });

  revalidatePath("/seo/keyword-research");
  revalidatePath(`/seo/keyword-research/${project.id}`);
  return { id: project.id };
}

export async function refreshSeoKeywordProject(projectId: string) {
  await requireSeoAccess();
  z.string().min(1).parse(projectId);

  const existing = await prisma.seoKeywordProject.findUnique({
    where: { id: projectId },
    select: { id: true },
  });
  if (!existing) throw new Error("Proyek tidak ditemukan.");

  await prisma.seoKeywordProject.update({
    where: { id: projectId },
    data: { status: "PENDING", errorMessage: null, dataNotice: null },
  });

  after(async () => {
    try {
      await enqueueKeywordResearch(projectId);
    } catch (err) {
      console.error("[refreshSeoKeywordProject] gagal", err);
    }
  });

  revalidatePath("/seo/keyword-research");
  revalidatePath(`/seo/keyword-research/${projectId}`);
}

export async function deleteSeoKeywordProject(projectId: string) {
  await requireSeoAccess();
  z.string().min(1).parse(projectId);

  await prisma.seoKeywordProject.delete({ where: { id: projectId } });
  revalidatePath("/seo/keyword-research");
}
