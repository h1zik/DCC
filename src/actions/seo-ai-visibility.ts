"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSeoAccess } from "@/lib/seo/auth";
import { isSeoRunStale, isSeoStatusBusy } from "@/lib/seo/labels";
import { runAiVisibility } from "@/lib/seo/ai-visibility/analyzer";

const MAX_KEYWORDS = 20;

const createSchema = z.object({
  name: z.string().min(1).max(120),
  brandTerms: z.array(z.string().min(2).max(100)).min(1).max(10),
  keywords: z.array(z.string().min(2).max(200)).min(1).max(MAX_KEYWORDS),
  platforms: z
    .array(z.enum(["chatgpt", "gemini", "claude", "perplexity"]))
    .min(1)
    .max(4),
});

export async function createAiVisibilityRun(
  input: z.infer<typeof createSchema>,
) {
  const session = await requireSeoAccess();
  const data = createSchema.parse(input);

  const dedupe = (list: string[]) => {
    const seen = new Set<string>();
    return list
      .map((s) => s.trim())
      .filter((s) => {
        const key = s.toLowerCase();
        if (!s || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  };

  const run = await prisma.seoAiVisibilityRun.create({
    data: {
      name: data.name.trim(),
      brandTerms: dedupe(data.brandTerms),
      keywords: dedupe(data.keywords).slice(0, MAX_KEYWORDS),
      platforms: [...new Set(data.platforms)],
      createdById: session.user.id,
    },
  });

  after(async () => {
    try {
      await runAiVisibility(run.id);
    } catch (err) {
      console.error("[createAiVisibilityRun] gagal", err);
    }
  });

  revalidatePath("/seo/ai-visibility");
  return { id: run.id };
}

/**
 * Jalankan ulang run yang sama (brand terms/keyword/platform tetap). Setiap
 * cek menanyakan ulang ke LLM (bypass cache). Ditolak bila run masih berjalan
 * dan belum macet (lihat `isSeoRunStale`).
 */
export async function rerunAiVisibilityRun(runId: string) {
  await requireSeoAccess();
  z.string().min(1).parse(runId);

  const existing = await prisma.seoAiVisibilityRun.findUnique({
    where: { id: runId },
    select: { id: true, status: true, updatedAt: true },
  });
  if (!existing) throw new Error("Run AI visibility tidak ditemukan.");
  if (
    isSeoStatusBusy(existing.status) &&
    !isSeoRunStale(existing.status, existing.updatedAt)
  ) {
    throw new Error("Run masih berjalan.");
  }

  await prisma.seoAiVisibilityRun.update({
    where: { id: runId },
    data: {
      status: "PENDING",
      errorMessage: null,
      dataNotice: null,
      results: [],
      summary: Prisma.JsonNull,
    },
  });

  after(async () => {
    try {
      await runAiVisibility(runId);
    } catch (err) {
      console.error("[rerunAiVisibilityRun] gagal", err);
    }
  });

  revalidatePath("/seo/ai-visibility");
  return { id: runId };
}

export async function deleteAiVisibilityRun(runId: string) {
  await requireSeoAccess();
  z.string().min(1).parse(runId);
  await prisma.seoAiVisibilityRun.delete({ where: { id: runId } });
  revalidatePath("/seo/ai-visibility");
}
