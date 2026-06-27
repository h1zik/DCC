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
  generateDraftFromBrief,
} from "@/lib/seo/content/generator";

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

export async function deleteContentBrief(briefId: string) {
  await requireSeoAccess();
  z.string().min(1).parse(briefId);
  await prisma.seoContentBrief.delete({ where: { id: briefId } });
  revalidatePath("/seo/content");
}

/* ---------------------------------- draft ---------------------------------- */

/** Tulis draft dari brief (inline — LLM menulis artikel; tombol menampilkan loading). */
export async function generateDraftFromBriefAction(briefId: string) {
  await requireSeoAccess();
  z.string().min(1).parse(briefId);
  try {
    const draftId = await generateDraftFromBrief(briefId);
    revalidatePath(`/seo/content/${briefId}`);
    revalidatePath(`/seo/content/draft/${draftId}`);
    return { draftId };
  } catch (err) {
    throw new Error(actionErrorMessage(err, "Gagal menulis draft."));
  }
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

export async function deleteContentDraft(draftId: string) {
  await requireSeoAccess();
  z.string().min(1).parse(draftId);
  await prisma.seoContentDraft.delete({ where: { id: draftId } });
  revalidatePath("/seo/content");
}
