"use server";

import { revalidatePath } from "next/cache";
import { RecStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireResearchHubAccess } from "@/lib/research/auth";

const recIdSchema = z.object({ recommendationId: z.string().min(1) });

/** Tutup loop rekomendasi: user menolak rekomendasi (tercatat, bukan hilang). */
export async function dismissResearchRecommendation(
  input: z.infer<typeof recIdSchema>,
) {
  await requireResearchHubAccess();
  const { recommendationId } = recIdSchema.parse(input);

  await prisma.researchRecommendation.update({
    where: { id: recommendationId },
    data: { status: RecStatus.DISMISSED, dismissedAt: new Date() },
  });

  revalidatePath("/research-hub");
}

const convertSchema = z.object({
  recommendationId: z.string().min(1),
  /** Task hasil tindak lanjut, bila dibuat lewat flow "Buat Brief"/manual. */
  convertedToTaskId: z.string().min(1).optional(),
});

/** Tandai rekomendasi sudah ditindaklanjuti (opsional: link ke task-nya). */
export async function convertResearchRecommendation(
  input: z.infer<typeof convertSchema>,
) {
  await requireResearchHubAccess();
  const data = convertSchema.parse(input);

  await prisma.researchRecommendation.update({
    where: { id: data.recommendationId },
    data: {
      status: RecStatus.CONVERTED,
      convertedAt: new Date(),
      convertedToTaskId: data.convertedToTaskId ?? null,
    },
  });

  revalidatePath("/research-hub");
}

/** Buka kembali rekomendasi yang di-dismiss/dikonversi keliru. */
export async function reopenResearchRecommendation(
  input: z.infer<typeof recIdSchema>,
) {
  await requireResearchHubAccess();
  const { recommendationId } = recIdSchema.parse(input);

  await prisma.researchRecommendation.update({
    where: { id: recommendationId },
    data: {
      status: RecStatus.OPEN,
      dismissedAt: null,
      convertedAt: null,
      convertedToTaskId: null,
    },
  });

  revalidatePath("/research-hub");
}
