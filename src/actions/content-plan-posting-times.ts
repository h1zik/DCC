"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireTasksRoomHubSession } from "@/lib/auth-helpers";
import { assertRoomMember } from "@/lib/room-access";
import {
  JAM_POSTING_REGEX,
  suggestPostingTimesCore,
  type PostingTimeSuggestResult,
} from "@/lib/content-plan-posting-suggest";

/**
 * Saran jam posting (WIB) dari AI untuk semua item content planning ruangan
 * yang punya tanggal posting hari ini atau ke depan.
 */
export async function suggestContentPlanPostingTimes(
  roomId: string,
): Promise<PostingTimeSuggestResult> {
  const session = await requireTasksRoomHubSession();
  await assertRoomMember(roomId, session.user.id);
  return suggestPostingTimesCore(roomId);
}

const applySchema = z.object({
  roomId: z.string().min(1),
  entries: z
    .array(
      z.object({
        itemId: z.string().min(1),
        jam: z.string().regex(JAM_POSTING_REGEX, "Format jam harus HH:mm."),
      }),
    )
    .min(1, "Pilih minimal satu saran jam."),
});

/**
 * Terapkan jam posting per item. Sengaja hanya menyentuh kolom `jamPosting`
 * (bukan lewat upsert baris penuh) agar tidak menimpa perubahan field lain.
 */
export async function applyContentPlanPostingTimes(
  input: z.infer<typeof applySchema>,
): Promise<{ updated: number }> {
  const session = await requireTasksRoomHubSession();
  const data = applySchema.parse(input);
  await assertRoomMember(data.roomId, session.user.id);

  const ids = [...new Set(data.entries.map((e) => e.itemId))];
  const rows = await prisma.roomContentPlanItem.findMany({
    where: { id: { in: ids }, roomId: data.roomId },
    select: { id: true },
  });
  const allowed = new Set(rows.map((r) => r.id));

  let updated = 0;
  for (const entry of data.entries) {
    if (!allowed.has(entry.itemId)) continue;
    await prisma.roomContentPlanItem.update({
      where: { id: entry.itemId },
      data: { jamPosting: entry.jam },
    });
    updated += 1;
  }

  revalidatePath(`/room/${data.roomId}/content-planning`);
  return { updated };
}
