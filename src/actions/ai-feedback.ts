"use server";

import { AiFeedbackVerdict } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireResearchHubAccess } from "@/lib/research/auth";

const feedbackSchema = z.object({
  module: z.string().min(1).max(60),
  artifactType: z.string().min(1).max(60),
  artifactId: z.string().min(1).max(200),
  verdict: z.nativeEnum(AiFeedbackVerdict),
  note: z.string().max(2000).optional(),
  /** Snapshot aiMeta artefak (model + prompt version) saat feedback diberikan. */
  aiMeta: z.unknown().optional(),
});

/**
 * Simpan thumbs up/down user pada output AI. Satu user satu vote per artefak
 * (vote ulang menimpa). Data ini bahan kalibrasi kualitas prompt/model.
 */
export async function submitAiOutputFeedback(
  input: z.infer<typeof feedbackSchema>,
) {
  const session = await requireResearchHubAccess();
  const data = feedbackSchema.parse(input);

  await prisma.aiOutputFeedback.upsert({
    where: {
      artifactType_artifactId_createdById: {
        artifactType: data.artifactType,
        artifactId: data.artifactId,
        createdById: session.user!.id!,
      },
    },
    create: {
      module: data.module,
      artifactType: data.artifactType,
      artifactId: data.artifactId,
      verdict: data.verdict,
      note: data.note ?? null,
      aiMeta: (data.aiMeta as object | undefined) ?? undefined,
      createdById: session.user!.id!,
    },
    update: {
      verdict: data.verdict,
      note: data.note ?? null,
      aiMeta: (data.aiMeta as object | undefined) ?? undefined,
    },
  });

  return { ok: true };
}
