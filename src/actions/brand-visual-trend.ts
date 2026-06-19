"use server";

import { revalidatePath } from "next/cache";
import { requireBrandManager } from "@/lib/brand-research/auth";
import { generateVisualTrendBrief } from "@/lib/brand-research/visual-trend-brief";

export async function generateVisualTrendBriefAction(
  collectionId: string | null,
  ownerBrandId?: string | null,
) {
  const session = await requireBrandManager();
  const brief = await generateVisualTrendBrief(
    session.user.id,
    ownerBrandId,
    collectionId,
  );
  revalidatePath("/brand-hub/visual-trend");
  return { brief };
}
