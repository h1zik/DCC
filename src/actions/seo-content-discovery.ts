"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSeoAccess } from "@/lib/seo/auth";
import { enqueueTopicDiscovery } from "@/lib/seo/content/topic-discovery";
import { isSeoRunStale, isSeoStatusBusy } from "@/lib/seo/labels";

const createSchema = z.object({
  seed: z.string().min(1).max(200),
});

export async function createTopicDiscovery(
  input: z.infer<typeof createSchema>,
) {
  const session = await requireSeoAccess();
  const data = createSchema.parse(input);

  const run = await prisma.seoContentTopicRun.create({
    data: { seed: data.seed.trim(), createdById: session.user.id },
  });

  after(async () => {
    try {
      await enqueueTopicDiscovery(run.id);
    } catch (err) {
      console.error("[createTopicDiscovery] gagal", err);
    }
  });

  revalidatePath("/seo/content/discover");
  return { id: run.id };
}

/**
 * Jalankan ulang Topic Discovery (setelah FAILED, atau bila run tampak macet:
 * busy > 15 menit tanpa update). Ditolak bila masih berjalan normal.
 */
export async function retryTopicDiscovery(runId: string) {
  await requireSeoAccess();
  z.string().min(1).parse(runId);

  const run = await prisma.seoContentTopicRun.findUnique({
    where: { id: runId },
    select: { status: true, updatedAt: true },
  });
  if (!run) throw new Error("Topic discovery tidak ditemukan.");
  if (isSeoStatusBusy(run.status) && !isSeoRunStale(run.status, run.updatedAt)) {
    throw new Error("Masih diproses.");
  }

  after(async () => {
    try {
      await enqueueTopicDiscovery(runId);
    } catch (err) {
      console.error("[retryTopicDiscovery] gagal", err);
    }
  });

  revalidatePath("/seo/content/discover");
}

export async function deleteTopicDiscovery(runId: string) {
  await requireSeoAccess();
  z.string().min(1).parse(runId);
  await prisma.seoContentTopicRun.delete({ where: { id: runId } });
  revalidatePath("/seo/content/discover");
}
