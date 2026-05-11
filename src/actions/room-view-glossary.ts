"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireTasksRoomHubSession } from "@/lib/auth-helpers";
import { assertRoomMember } from "@/lib/room-access";

async function ensureGlossaryMember(viewId: string, userId: string) {
  const v = await prisma.roomView.findUniqueOrThrow({
    where: { id: viewId },
    select: { roomId: true, type: true },
  });
  if (v.type !== "GLOSSARY") throw new Error("View bukan tipe Glosarium.");
  await assertRoomMember(v.roomId, userId);
  return v.roomId;
}

function normalizeTags(input: string[] | undefined | null): string[] {
  if (!input) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of input) {
    const t = raw.trim().toLowerCase().slice(0, 30);
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= 12) break;
  }
  return out;
}

const upsertSchema = z.object({
  id: z.string().optional(),
  viewId: z.string().min(1),
  term: z.string().trim().min(1).max(120),
  definition: z.string().trim().min(1).max(5000),
  examples: z.string().trim().max(5000).optional().nullable(),
  tags: z.array(z.string()).optional().default([]),
});

export async function upsertRoomGlossaryEntry(
  input: z.infer<typeof upsertSchema>,
) {
  const session = await requireTasksRoomHubSession();
  const data = upsertSchema.parse(input);
  const roomId = await ensureGlossaryMember(data.viewId, session.user.id);

  const tags = normalizeTags(data.tags);

  if (data.id) {
    await prisma.roomGlossaryEntry.update({
      where: { id: data.id },
      data: {
        term: data.term,
        definition: data.definition,
        examples: data.examples?.trim() || null,
        tags,
      },
    });
  } else {
    const max = await prisma.roomGlossaryEntry.aggregate({
      where: { viewId: data.viewId },
      _max: { sortOrder: true },
    });
    await prisma.roomGlossaryEntry.create({
      data: {
        viewId: data.viewId,
        term: data.term,
        definition: data.definition,
        examples: data.examples?.trim() || null,
        tags,
        sortOrder: (max._max.sortOrder ?? -1) + 1,
      },
    });
  }
  revalidatePath(`/room/${roomId}/view/${data.viewId}`);
}

export async function deleteRoomGlossaryEntry(entryId: string) {
  const session = await requireTasksRoomHubSession();
  const e = await prisma.roomGlossaryEntry.findUniqueOrThrow({
    where: { id: entryId },
    select: { viewId: true },
  });
  const roomId = await ensureGlossaryMember(e.viewId, session.user.id);
  await prisma.roomGlossaryEntry.delete({ where: { id: entryId } });
  revalidatePath(`/room/${roomId}/view/${e.viewId}`);
}
