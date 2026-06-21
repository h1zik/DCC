"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { SocialListeningPlatform } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireMarketAnalyst } from "@/lib/research/auth";
import {
  analyzeSocialListeningComments,
  resolveCommentAnalysisBatchId,
} from "@/lib/research/social-listening/analyze-social-listening-comments";
import {
  DEFAULT_INSTAGRAM_SEARCH_LIMIT,
  DEFAULT_TIKTOK_SEARCH_LIMIT,
  MAX_INSTAGRAM_SEARCH_LIMIT,
  MAX_TIKTOK_SEARCH_LIMIT,
  clampSocialSearchLimit,
} from "@/lib/research/social-listening/search-limits-public";
import {
  beginSocialListeningSync,
  finalizeSocialListeningBatch,
} from "@/lib/research/social-listening/social-sync";

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

const updateSearchLimitsSchema = z.object({
  monitorId: z.string().min(1),
  tiktokSearchLimit: z.number().int().min(1).max(MAX_TIKTOK_SEARCH_LIMIT),
  instagramSearchLimit: z.number().int().min(1).max(MAX_INSTAGRAM_SEARCH_LIMIT),
});

export async function createSocialListeningMonitor(
  input: z.infer<typeof monitorSchema>,
) {
  const session = await requireMarketAnalyst();
  const data = monitorSchema.parse(input);

  const monitor = await prisma.socialListeningMonitor.create({
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

  revalidatePath("/research-hub/social-listening");
  return { id: monitor.id };
}

export async function updateSocialListeningMonitorSearchLimits(
  input: z.infer<typeof updateSearchLimitsSchema>,
) {
  await requireMarketAnalyst();
  const data = updateSearchLimitsSchema.parse(input);

  await prisma.socialListeningMonitor.update({
    where: { id: data.monitorId },
    data: {
      tiktokSearchLimit: clampSocialSearchLimit(
        data.tiktokSearchLimit,
        MAX_TIKTOK_SEARCH_LIMIT,
      ),
      instagramSearchLimit: clampSocialSearchLimit(
        data.instagramSearchLimit,
        MAX_INSTAGRAM_SEARCH_LIMIT,
      ),
    },
  });

  revalidatePath("/research-hub/social-listening");
  revalidatePath(`/research-hub/social-listening/${data.monitorId}`);
}

export async function refreshSocialListeningMonitor(monitorId: string) {
  await requireMarketAnalyst();
  z.string().min(1).parse(monitorId);

  const { batchId } = await beginSocialListeningSync(monitorId);

  after(async () => {
    try {
      await finalizeSocialListeningBatch(batchId);
    } catch (err) {
      console.error("[refreshSocialListeningMonitor] finalize gagal", err);
    }
  });

  revalidatePath("/research-hub/social-listening");
  revalidatePath(`/research-hub/social-listening/${monitorId}`);
}

export async function analyzeSocialListeningCommentsAction(
  monitorId: string,
) {
  await requireMarketAnalyst();
  z.string().min(1).parse(monitorId);

  const batchId = await resolveCommentAnalysisBatchId(monitorId);

  await prisma.socialListeningBatch.update({
    where: { id: batchId },
    data: { status: "ANALYZING" },
  });

  after(async () => {
    try {
      await analyzeSocialListeningComments(batchId);
    } catch (err) {
      console.error("[analyzeSocialListeningComments] gagal", err);
    }
  });

  revalidatePath("/research-hub/social-listening");
  revalidatePath(`/research-hub/social-listening/${monitorId}`);
}

export async function toggleSocialListeningMonitorActive(
  monitorId: string,
  isActive: boolean,
) {
  await requireMarketAnalyst();
  z.string().min(1).parse(monitorId);

  await prisma.socialListeningMonitor.update({
    where: { id: monitorId },
    data: { isActive },
  });

  revalidatePath("/research-hub/social-listening");
}

export async function deleteSocialListeningMonitor(monitorId: string) {
  await requireMarketAnalyst();
  z.string().min(1).parse(monitorId);

  await prisma.socialListeningMonitor.delete({ where: { id: monitorId } });
  revalidatePath("/research-hub/social-listening");
}
