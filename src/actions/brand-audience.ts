"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { BrandAudienceStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireBrandManager } from "@/lib/brand-research/auth";
import {
  assessBrandEvidenceReadiness,
  formatEvidenceGateError,
} from "@/lib/brand-research/strategy/evidence-gate";
import {
  generateBrandAudienceProfile,
  listBrandAudienceProfiles,
} from "@/lib/brand-research/audience/audience-generator";
import {
  defaultStrategyGenerationConfig,
  getStrategySourceCatalog,
  validateStrategyGenerationConfig,
} from "@/lib/brand-research/strategy/strategy-source-catalog";
import type { StrategyGenerationConfig } from "@/lib/brand-research/strategy/evidence-types";

const createSchema = z.object({
  ownerBrandId: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  pmBrief: z.string().optional().nullable(),
});

export async function createBrandAudienceProfile(
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
  const config = defaultStrategyGenerationConfig(catalog);

  const profile = await prisma.brandAudienceProfile.create({
    data: {
      ownerBrandId: data.ownerBrandId ?? null,
      category: data.category?.trim() || null,
      pmBrief: data.pmBrief?.trim() || null,
      status: BrandAudienceStatus.DRAFT,
      createdById: session.user.id,
      generationConfig: config as object,
    },
  });

  after(async () => {
    try {
      await generateBrandAudienceProfile(profile.id, session.user.id, config);
    } catch (err) {
      console.error("[createBrandAudienceProfile]", err);
    }
  });

  revalidatePath("/brand-hub/audience");
  return { id: profile.id };
}

export async function regenerateBrandAudienceProfile(profileId: string) {
  const session = await requireBrandManager();
  z.string().min(1).parse(profileId);

  const profile = await prisma.brandAudienceProfile.findFirst({
    where: { id: profileId },
    select: { ownerBrandId: true, generationConfig: true },
  });
  if (!profile) throw new Error("Profil audiens tidak ditemukan.");

  const readiness = await assessBrandEvidenceReadiness(
    session.user.id,
    profile.ownerBrandId,
  );
  if (!readiness.canGenerate) {
    throw new Error(formatEvidenceGateError(readiness));
  }

  const catalog = await getStrategySourceCatalog(
    session.user.id,
    profile.ownerBrandId,
  );
  const config =
    (profile.generationConfig as StrategyGenerationConfig | null) ??
    defaultStrategyGenerationConfig(catalog);

  const validation = validateStrategyGenerationConfig(config, catalog);
  if (!validation.ok) {
    throw new Error(validation.message ?? "Konfigurasi sumber tidak valid.");
  }

  after(async () => {
    try {
      await generateBrandAudienceProfile(profileId, session.user.id, config);
    } catch (err) {
      console.error("[regenerateBrandAudienceProfile]", err);
    }
  });

  revalidatePath("/brand-hub/audience");
}

export async function deleteBrandAudienceProfile(profileId: string) {
  await requireBrandManager();
  const existing = await prisma.brandAudienceProfile.findUnique({
    where: { id: profileId },
    select: { id: true },
  });
  if (!existing) throw new Error("Profil audiens tidak ditemukan.");
  await prisma.brandAudienceProfile.delete({ where: { id: profileId } });
  revalidatePath("/brand-hub/audience");
}

export async function getBrandAudiencePageData(ownerBrandId?: string | null) {
  const session = await requireBrandManager();
  const [profiles, evidenceReadiness] = await Promise.all([
    listBrandAudienceProfiles(session.user.id, ownerBrandId),
    assessBrandEvidenceReadiness(session.user.id, ownerBrandId ?? null),
  ]);
  return {
    evidenceReadiness,
    profiles: profiles.map((p) => ({
      id: p.id,
      status: p.status,
      version: p.version,
      ownerBrandId: p.ownerBrandId,
      category: p.category,
      pmBrief: p.pmBrief,
      personas: p.personas,
      aiSummary: p.aiSummary,
      actionPlan: p.actionPlan,
      evidenceRefs: p.evidenceRefs,
      errorMessage: p.errorMessage,
      updatedAt: p.updatedAt.toISOString(),
    })),
  };
}
