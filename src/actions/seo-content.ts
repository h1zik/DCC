"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSeoAccess } from "@/lib/seo/auth";
import { actionErrorMessage } from "@/lib/action-error-message";
import {
  analyzeContentDraft,
  generateContentBrief,
} from "@/lib/seo/content/generator";
import {
  createDraftForBrief,
  writeDraftFromBrief,
} from "@/lib/seo/content/draft-writer";
import { Prisma } from "@prisma/client";
import { isDataForSeoConfigured } from "@/lib/seo/dataforseo/client";
import { fetchSerpLive } from "@/lib/seo/dataforseo/serp";
import { extractSignalsFromHtml } from "@/lib/seo/content/html-signals-server";
import {
  buildOriginalityReport,
  sampleDistinctiveSentences,
} from "@/lib/seo/content/originality";

/* ---------------------------------- brief ---------------------------------- */

const createBriefSchema = z.object({
  targetKeyword: z.string().min(1).max(200),
  title: z.string().min(1).max(200),
});

export async function createContentBrief(
  input: z.infer<typeof createBriefSchema>,
) {
  const session = await requireSeoAccess();
  const data = createBriefSchema.parse(input);

  const brief = await prisma.seoContentBrief.create({
    data: {
      targetKeyword: data.targetKeyword.trim(),
      title: data.title.trim(),
      createdById: session.user.id,
    },
  });

  after(async () => {
    try {
      await generateContentBrief(brief.id);
    } catch (err) {
      console.error("[createContentBrief] gagal", err);
    }
  });

  revalidatePath("/seo/content");
  revalidatePath(`/seo/content/${brief.id}`);
  return { id: brief.id };
}

/** Ulangi pipeline brief (mis. setelah FAILED atau untuk refresh grounding). */
export async function retryContentBrief(briefId: string) {
  await requireSeoAccess();
  z.string().min(1).parse(briefId);

  const brief = await prisma.seoContentBrief.findUnique({
    where: { id: briefId },
    select: { status: true },
  });
  if (!brief) throw new Error("Brief tidak ditemukan.");
  if (
    brief.status === "COLLECTING" ||
    brief.status === "ANALYZING" ||
    brief.status === "PENDING"
  ) {
    throw new Error("Brief masih diproses.");
  }

  after(async () => {
    try {
      await generateContentBrief(briefId);
    } catch (err) {
      console.error("[retryContentBrief] gagal", err);
    }
  });

  revalidatePath(`/seo/content/${briefId}`);
}

export async function deleteContentBrief(briefId: string) {
  await requireSeoAccess();
  z.string().min(1).parse(briefId);
  await prisma.seoContentBrief.delete({ where: { id: briefId } });
  revalidatePath("/seo/content");
}

/* ---------------------------------- draft ---------------------------------- */

/** Mulai penulisan draft dari brief (background, resumable — redirect ke editor). */
export async function generateDraftFromBriefAction(briefId: string) {
  await requireSeoAccess();
  z.string().min(1).parse(briefId);
  try {
    const draftId = await createDraftForBrief(briefId);
    after(async () => {
      try {
        await writeDraftFromBrief(draftId);
      } catch (err) {
        console.error("[generateDraftFromBriefAction] gagal", err);
      }
    });
    revalidatePath(`/seo/content/${briefId}`);
    revalidatePath(`/seo/content/draft/${draftId}`);
    return { draftId };
  } catch (err) {
    throw new Error(actionErrorMessage(err, "Gagal memulai penulisan draft."));
  }
}

/** Lanjutkan penulisan draft yang gagal/terputus — step selesai dilewati. */
export async function resumeDraftGenerationAction(draftId: string) {
  await requireSeoAccess();
  z.string().min(1).parse(draftId);

  const draft = await prisma.seoContentDraft.findUnique({
    where: { id: draftId },
    select: { status: true, briefId: true },
  });
  if (!draft) throw new Error("Draft tidak ditemukan.");
  if (!draft.briefId) throw new Error("Draft ini tidak terhubung ke brief.");
  if (draft.status === "ANALYZING" || draft.status === "COLLECTING") {
    throw new Error("Draft masih diproses.");
  }

  after(async () => {
    try {
      await writeDraftFromBrief(draftId);
    } catch (err) {
      console.error("[resumeDraftGenerationAction] gagal", err);
    }
  });
  revalidatePath(`/seo/content/draft/${draftId}`);
}

const blankDraftSchema = z.object({
  title: z.string().min(1).max(200),
  targetKeyword: z.string().max(200).optional(),
});

export async function createBlankDraft(input: z.infer<typeof blankDraftSchema>) {
  const session = await requireSeoAccess();
  const data = blankDraftSchema.parse(input);

  const draft = await prisma.seoContentDraft.create({
    data: {
      title: data.title.trim(),
      targetKeyword: data.targetKeyword?.trim() || null,
      contentHtml: "",
      createdById: session.user.id,
    },
  });
  revalidatePath("/seo/content");
  return { draftId: draft.id };
}

const saveDraftSchema = z.object({
  draftId: z.string().min(1),
  title: z.string().min(1).max(200),
  targetKeyword: z.string().max(200).optional(),
  contentHtml: z.string().max(500000),
  metaTitle: z.string().max(120).optional(),
  metaDescription: z.string().max(320).optional(),
  slug: z.string().max(120).optional(),
});

export async function saveContentDraft(input: z.infer<typeof saveDraftSchema>) {
  await requireSeoAccess();
  const data = saveDraftSchema.parse(input);

  await prisma.seoContentDraft.update({
    where: { id: data.draftId },
    data: {
      title: data.title.trim(),
      targetKeyword: data.targetKeyword?.trim() || null,
      contentHtml: data.contentHtml,
      metaTitle: data.metaTitle?.trim() || null,
      metaDescription: data.metaDescription?.trim() || null,
      slug: data.slug?.trim() || null,
    },
  });
  revalidatePath(`/seo/content/draft/${data.draftId}`);
}

export async function analyzeDraftAction(draftId: string) {
  await requireSeoAccess();
  z.string().min(1).parse(draftId);
  try {
    await analyzeContentDraft(draftId);
    revalidatePath(`/seo/content/draft/${draftId}`);
  } catch (err) {
    throw new Error(actionErrorMessage(err, "Gagal menganalisis draft."));
  }
}

/**
 * Cek orisinalitas: sampel kalimat khas → cari frasa persis di Google.
 * ~6 panggilan SERP per cek (di-cache 24 jam).
 */
export async function checkDraftOriginality(draftId: string) {
  await requireSeoAccess();
  z.string().min(1).parse(draftId);

  if (!isDataForSeoConfigured()) {
    throw new Error("DataForSEO belum dikonfigurasi.");
  }

  const draft = await prisma.seoContentDraft.findUnique({
    where: { id: draftId },
  });
  if (!draft) throw new Error("Draft tidak ditemukan.");

  try {
    const signals = extractSignalsFromHtml(draft.contentHtml);
    const sentences = sampleDistinctiveSentences(signals.text);
    if (sentences.length === 0) {
      throw new Error("Draft terlalu pendek untuk dicek orisinalitasnya.");
    }

    const results: {
      sentence: string;
      matches: { url: string; title: string | null }[];
    }[] = [];
    for (const sentence of sentences) {
      const lookup = await fetchSerpLive(`"${sentence}"`, { depth: 10 });
      results.push({
        sentence,
        matches: lookup.items
          .filter((i) => i.type === "organic" && i.url)
          .slice(0, 3)
          .map((i) => ({ url: i.url!, title: i.title ?? null })),
      });
    }

    const report = buildOriginalityReport(results, new Date().toISOString());
    const analysis =
      draft.analysis && typeof draft.analysis === "object" && !Array.isArray(draft.analysis)
        ? (draft.analysis as Record<string, unknown>)
        : {};
    analysis.originality = report;

    await prisma.seoContentDraft.update({
      where: { id: draftId },
      data: { analysis: analysis as Prisma.InputJsonValue },
    });
    revalidatePath(`/seo/content/draft/${draftId}`);
    return report;
  } catch (err) {
    throw new Error(actionErrorMessage(err, "Gagal cek orisinalitas."));
  }
}

export async function deleteContentDraft(draftId: string) {
  await requireSeoAccess();
  z.string().min(1).parse(draftId);
  await prisma.seoContentDraft.delete({ where: { id: draftId } });
  revalidatePath("/seo/content");
}
