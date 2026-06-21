"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { SocialListeningPlatform } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireBrandManager } from "@/lib/brand-research/auth";
import {
  beginBrandSocialListeningSync,
  finalizeBrandSocialListeningBatch,
} from "@/lib/brand-research/social-sync";
import {
  DEFAULT_INSTAGRAM_SEARCH_LIMIT,
  DEFAULT_TIKTOK_SEARCH_LIMIT,
  MAX_INSTAGRAM_SEARCH_LIMIT,
  MAX_TIKTOK_SEARCH_LIMIT,
  clampSocialSearchLimit,
} from "@/lib/research/social-listening/search-limits-public";

const monitorSchema = z.object({
  name: z.string().min(1).max(120),
  keywords: z.array(z.string().min(1).max(100)).min(1).max(20),
  platforms: z
    .array(z.nativeEnum(SocialListeningPlatform))
    .min(1)
    .max(2),
  tiktokSearchLimit: z.number().int().min(1).max(MAX_TIKTOK_SEARCH_LIMIT).optional(),
  instagramSearchLimit: z
    .number()
    .int()
    .min(1)
    .max(MAX_INSTAGRAM_SEARCH_LIMIT)
    .optional(),
});

export async function createBrandSocialListeningMonitor(
  input: z.infer<typeof monitorSchema>,
) {
  const session = await requireBrandManager();
  const data = monitorSchema.parse(input);

  const monitor = await prisma.brandSocialMonitor.create({
    data: {
      name: data.name,
      keywords: data.keywords.map((k) => k.trim()),
      platforms: data.platforms,
      tiktokSearchLimit: clampSocialSearchLimit(
        data.tiktokSearchLimit ?? DEFAULT_TIKTOK_SEARCH_LIMIT,
        MAX_TIKTOK_SEARCH_LIMIT,
      ),
      instagramSearchLimit: clampSocialSearchLimit(
        data.instagramSearchLimit ?? DEFAULT_INSTAGRAM_SEARCH_LIMIT,
        MAX_INSTAGRAM_SEARCH_LIMIT,
      ),
      createdById: session.user.id,
    },
  });

  revalidatePath("/brand-hub/social-listening");
  return { id: monitor.id };
}

export async function refreshBrandSocialListeningMonitor(monitorId: string) {
  await requireBrandManager();
  z.string().min(1).parse(monitorId);

  const { batchId } = await beginBrandSocialListeningSync(monitorId);

  after(async () => {
    try {
      await finalizeBrandSocialListeningBatch(batchId);
    } catch (err) {
      console.error("[refreshBrandSocialListeningMonitor] finalize gagal", err);
    }
  });

  revalidatePath("/brand-hub/social-listening");
  revalidatePath(`/brand-hub/social-listening/${monitorId}`);
}

export async function toggleBrandSocialListeningMonitorActive(
  monitorId: string,
  isActive: boolean,
) {
  await requireBrandManager();
  z.string().min(1).parse(monitorId);

  await prisma.brandSocialMonitor.update({
    where: { id: monitorId },
    data: { isActive },
  });

  revalidatePath("/brand-hub/social-listening");
}

export async function deleteBrandSocialListeningMonitor(monitorId: string) {
  await requireBrandManager();
  z.string().min(1).parse(monitorId);

  await prisma.brandSocialMonitor.delete({ where: { id: monitorId } });
  revalidatePath("/brand-hub/social-listening");
}
