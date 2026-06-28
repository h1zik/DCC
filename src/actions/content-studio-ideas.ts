"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireContentStudioAccess } from "@/lib/content-studio/auth";
import { runIdeaGeneration } from "@/lib/content-studio/idea-generator";

const PLATFORMS = ["Instagram", "TikTok", "TikTok Shop", "Shopee"] as const;

const createSchema = z.object({
  topic: z.string().trim().min(3, "Topik minimal 3 karakter.").max(200),
  goal: z.string().trim().max(300).optional().nullable(),
  ownerBrandId: z.string().trim().optional().nullable(),
  platforms: z.array(z.enum(PLATFORMS)).default([]),
});

function setName(topic: string): string {
  return topic.length > 60 ? `${topic.slice(0, 57)}…` : topic;
}

export async function createContentIdeaSet(input: z.infer<typeof createSchema>) {
  const session = await requireContentStudioAccess();
  const data = createSchema.parse(input);

  const set = await prisma.contentStudioIdeaSet.create({
    data: {
      name: setName(data.topic),
      topic: data.topic,
      goal: data.goal?.trim() || null,
      ownerBrandId: data.ownerBrandId?.trim() || null,
      platforms: data.platforms,
      status: "PENDING",
      createdById: session.user.id,
    },
  });

  after(async () => {
    try {
      await runIdeaGeneration(set.id);
    } catch (err) {
      console.error("[createContentIdeaSet]", err);
    }
  });

  revalidatePath("/content-studio/ideas");
  return { id: set.id };
}

export async function refreshContentIdeaSet(setId: string) {
  await requireContentStudioAccess();
  z.string().min(1).parse(setId);

  const set = await prisma.contentStudioIdeaSet.findUnique({
    where: { id: setId },
    select: { id: true },
  });
  if (!set) throw new Error("Set ide tidak ditemukan.");

  await prisma.contentStudioIdeaSet.update({
    where: { id: setId },
    data: { status: "PENDING", errorMessage: null },
  });

  after(async () => {
    try {
      await runIdeaGeneration(setId);
    } catch (err) {
      console.error("[refreshContentIdeaSet]", err);
    }
  });

  revalidatePath("/content-studio/ideas");
  revalidatePath(`/content-studio/ideas/${setId}`);
  return { id: setId };
}

export async function deleteContentIdeaSet(setId: string) {
  await requireContentStudioAccess();
  z.string().min(1).parse(setId);
  await prisma.contentStudioIdeaSet.delete({ where: { id: setId } });
  revalidatePath("/content-studio/ideas");
  return { ok: true };
}

const feedbackSchema = z.object({
  ideaId: z.string().min(1),
  feedback: z.enum(["UP", "DOWN"]).nullable(),
});

/** Toggle 👍/👎 — feedback ini jadi few-shot untuk generasi berikutnya (mesin adopsi). */
export async function setContentIdeaFeedback(
  input: z.infer<typeof feedbackSchema>,
) {
  await requireContentStudioAccess();
  const { ideaId, feedback } = feedbackSchema.parse(input);

  const idea = await prisma.contentStudioIdea.findUnique({
    where: { id: ideaId },
    select: { id: true, setId: true },
  });
  if (!idea) throw new Error("Ide tidak ditemukan.");

  await prisma.contentStudioIdea.update({
    where: { id: ideaId },
    data: { feedback },
  });

  revalidatePath(`/content-studio/ideas/${idea.setId}`);
  return { ok: true };
}

const usedSchema = z.object({
  ideaId: z.string().min(1),
  used: z.boolean(),
});

export async function markContentIdeaUsed(input: z.infer<typeof usedSchema>) {
  await requireContentStudioAccess();
  const { ideaId, used } = usedSchema.parse(input);

  const idea = await prisma.contentStudioIdea.findUnique({
    where: { id: ideaId },
    select: { id: true, setId: true },
  });
  if (!idea) throw new Error("Ide tidak ditemukan.");

  await prisma.contentStudioIdea.update({
    where: { id: ideaId },
    data: { used },
  });

  revalidatePath(`/content-studio/ideas/${idea.setId}`);
  return { ok: true };
}
