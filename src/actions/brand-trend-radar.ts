"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireBrandManager } from "@/lib/brand-research/auth";
import { generateBrandTrendDigest } from "@/lib/brand-research/trend-analyzer";
import {
  getDefaultTrendSourceConfig,
  parseTrendSourceConfigJson,
  validateTrendSourceConfig,
} from "@/lib/research/trend-radar/trend-source-config";
import type { TrendSourceConfig } from "@/lib/research/trend-radar/trend-source-config-types";

const refreshDigestSchema = z.object({
  ownerBrandId: z.string().optional().nullable(),
  seedKeywords: z.array(z.string().min(1).max(100)).optional(),
  digestLabel: z.string().max(120).optional(),
  sourceConfig: z.unknown().optional(),
});

export async function getBrandTrendRadarSourceDefaults(): Promise<{
  defaults: TrendSourceConfig;
}> {
  await requireBrandManager();
  return { defaults: getDefaultTrendSourceConfig() };
}

export async function refreshGlobalBrandTrendDigest(
  input?: z.infer<typeof refreshDigestSchema>,
) {
  await requireBrandManager();
  const data = input ? refreshDigestSchema.parse(input) : {};
  const sourceConfig = data.sourceConfig
    ? validateTrendSourceConfig(data.sourceConfig)
    : getDefaultTrendSourceConfig();

  try {
    await generateBrandTrendDigest({
      isGlobal: true,
      ownerBrandId: data.ownerBrandId ?? null,
      seedKeywords: data.seedKeywords,
      digestLabel: data.digestLabel,
      sourceConfig,
    });
  } catch (err) {
    console.error("[refreshGlobalBrandTrendDigest] gagal", err);
    throw err;
  }

  revalidatePath("/brand-hub/trend-radar");
}

export async function refreshBrandTrendDigest(
  digestId: string,
  sourceConfigInput?: TrendSourceConfig,
) {
  await requireBrandManager();
  z.string().min(1).parse(digestId);

  const digest = await prisma.brandTrendDigest.findUnique({
    where: { id: digestId },
  });
  if (!digest) throw new Error("Digest tidak ditemukan.");

  const stored = parseTrendSourceConfigJson(digest.sourceConfig);
  const sourceConfig = sourceConfigInput
    ? validateTrendSourceConfig(sourceConfigInput)
    : stored ?? getDefaultTrendSourceConfig();

  const seedKeywords = Array.isArray(
    (digest.sourceConfig as { seedKeywords?: unknown } | null)?.seedKeywords,
  )
    ? ((digest.sourceConfig as { seedKeywords: string[] }).seedKeywords ?? [])
    : undefined;

  try {
    await generateBrandTrendDigest({
      digestId,
      isGlobal: digest.isGlobal,
      ownerBrandId: digest.ownerBrandId,
      seedKeywords,
      sourceConfig,
    });
  } catch (err) {
    console.error("[refreshBrandTrendDigest] gagal", err);
    throw err;
  }

  revalidatePath("/brand-hub/trend-radar");
  revalidatePath(`/brand-hub/trend-radar/${digestId}`);
}

export async function deleteBrandTrendDigest(digestId: string) {
  await requireBrandManager();
  z.string().min(1).parse(digestId);

  await prisma.brandTrendDigest.delete({ where: { id: digestId } });
  revalidatePath("/brand-hub/trend-radar");
}
