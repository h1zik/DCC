"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePersonalOwnerId } from "@/lib/personal-space";

/**
 * Papan tugas (kanban) Space Pribadi. Semua query difilter `ownerId` —
 * TANPA bypass peran. `ownerId` didenormalisasi ke kartu sehingga guard
 * tidak butuh join. Id milik user lain ⇒ "Tidak ditemukan.".
 */

const HEX = /^#[0-9a-fA-F]{6}$/;

function revalidate() {
  revalidatePath("/personal/kanban");
}

export async function createPersonalColumn(input: {
  title: string;
  colorHex?: string | null;
}) {
  const ownerId = await requirePersonalOwnerId();
  const data = z
    .object({
      title: z.string().trim().min(1, "Judul kolom wajib diisi.").max(80),
      colorHex: z.string().regex(HEX).nullable().optional(),
    })
    .parse(input);
  const last = await prisma.personalKanbanColumn.findFirst({
    where: { ownerId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  await prisma.personalKanbanColumn.create({
    data: {
      ownerId,
      title: data.title,
      colorHex: data.colorHex ?? null,
      sortOrder: (last?.sortOrder ?? -1) + 1,
    },
  });
  revalidate();
}

export async function updatePersonalColumn(input: {
  id: string;
  title?: string;
  colorHex?: string | null;
}) {
  const ownerId = await requirePersonalOwnerId();
  const data = z
    .object({
      id: z.string().cuid(),
      title: z.string().trim().min(1).max(80).optional(),
      colorHex: z.string().regex(HEX).nullable().optional(),
    })
    .parse(input);
  const res = await prisma.personalKanbanColumn.updateMany({
    where: { id: data.id, ownerId },
    data: {
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.colorHex !== undefined ? { colorHex: data.colorHex } : {}),
    },
  });
  if (res.count === 0) throw new Error("Tidak ditemukan.");
  revalidate();
}

export async function reorderPersonalColumns(orderedIds: string[]) {
  const ownerId = await requirePersonalOwnerId();
  const ids = z
    .array(z.string().cuid())
    .min(1)
    .max(100)
    .refine((value) => new Set(value).size === value.length, {
      message: "Urutan kolom tidak valid.",
    })
    .parse(orderedIds);
  const ownedColumns = await prisma.personalKanbanColumn.findMany({
    where: { ownerId },
    select: { id: true },
  });
  const ownedIds = new Set(ownedColumns.map((column) => column.id));
  if (ids.length !== ownedIds.size || ids.some((id) => !ownedIds.has(id))) {
    throw new Error("Urutan kolom tidak valid.");
  }
  await prisma.$transaction(
    ids.map((id, index) =>
      prisma.personalKanbanColumn.updateMany({
        where: { id, ownerId },
        data: { sortOrder: index },
      }),
    ),
  );
  revalidate();
}

/** Hapus kolom beserta kartunya (cascade di schema). */
export async function deletePersonalColumn(id: string) {
  const ownerId = await requirePersonalOwnerId();
  const res = await prisma.personalKanbanColumn.deleteMany({
    where: { id: z.string().cuid().parse(id), ownerId },
  });
  if (res.count === 0) throw new Error("Tidak ditemukan.");
  revalidate();
}

const cardSchema = z.object({
  id: z.string().cuid().optional(),
  columnId: z.string().cuid().optional(),
  title: z.string().trim().min(1, "Judul kartu wajib diisi.").max(200),
  description: z.string().trim().max(5000).nullable().optional(),
  dueDate: z.coerce.date().nullable().optional(),
  isDone: z.boolean().optional(),
});

export async function upsertPersonalCard(input: {
  id?: string;
  columnId?: string;
  title: string;
  description?: string | null;
  dueDate?: string | null;
  isDone?: boolean;
}) {
  const ownerId = await requirePersonalOwnerId();
  const data = cardSchema.parse(input);
  const dueDate = data.dueDate;

  if (data.id) {
    const res = await prisma.personalKanbanCard.updateMany({
      where: { id: data.id, ownerId },
      data: {
        title: data.title,
        description: data.description ?? null,
        ...(dueDate !== undefined ? { dueDate } : {}),
        ...(data.isDone !== undefined ? { isDone: data.isDone } : {}),
      },
    });
    if (res.count === 0) throw new Error("Tidak ditemukan.");
  } else {
    if (!data.columnId) throw new Error("Kolom tujuan wajib dipilih.");
    // Verifikasi kolom milik user login — mencegah menaruh kartu di kolom orang lain.
    const column = await prisma.personalKanbanColumn.findFirst({
      where: { id: data.columnId, ownerId },
      select: { id: true },
    });
    if (!column) throw new Error("Tidak ditemukan.");
    const last = await prisma.personalKanbanCard.findFirst({
      where: { columnId: column.id, ownerId },
      orderBy: { sortKey: "desc" },
      select: { sortKey: true },
    });
    await prisma.personalKanbanCard.create({
      data: {
        ownerId,
        columnId: column.id,
        title: data.title,
        description: data.description ?? null,
        dueDate: dueDate ?? null,
        isDone: data.isDone ?? false,
        sortKey: (last?.sortKey ?? -1000) + 1000,
      },
    });
  }
  revalidate();
}

export async function togglePersonalCardDone(id: string, isDone: boolean) {
  const ownerId = await requirePersonalOwnerId();
  const res = await prisma.personalKanbanCard.updateMany({
    where: { id: z.string().cuid().parse(id), ownerId },
    data: { isDone: z.boolean().parse(isDone) },
  });
  if (res.count === 0) throw new Error("Tidak ditemukan.");
  revalidate();
}

/**
 * Pindahkan kartu (bisa lintas kolom) + tulis ulang urutan kolom tujuan.
 * `orderedCardIds` = urutan final SEMUA kartu di kolom tujuan (termasuk
 * kartu yang dipindah). Pola sama dengan persistKanbanColumnOrder di tasks.
 */
export async function movePersonalCard(input: {
  cardId: string;
  toColumnId: string;
  orderedCardIds: string[];
}) {
  const ownerId = await requirePersonalOwnerId();
  const data = z
    .object({
      cardId: z.string().cuid(),
      toColumnId: z.string().cuid(),
      orderedCardIds: z.array(z.string().cuid()).min(1).max(500),
    })
    .parse(input);

  const column = await prisma.personalKanbanColumn.findFirst({
    where: { id: data.toColumnId, ownerId },
    select: { id: true },
  });
  if (!column) throw new Error("Tidak ditemukan.");

  const moved = await prisma.personalKanbanCard.updateMany({
    where: { id: data.cardId, ownerId },
    data: { columnId: column.id },
  });
  if (moved.count === 0) throw new Error("Tidak ditemukan.");

  await prisma.$transaction(
    data.orderedCardIds.map((id, index) =>
      prisma.personalKanbanCard.updateMany({
        // Filter columnId ikut disertakan: id asing/lintas-kolom diabaikan.
        where: { id, ownerId, columnId: column.id },
        data: { sortKey: index * 1000 },
      }),
    ),
  );
  revalidate();
}

export async function deletePersonalCard(id: string) {
  const ownerId = await requirePersonalOwnerId();
  const res = await prisma.personalKanbanCard.deleteMany({
    where: { id: z.string().cuid().parse(id), ownerId },
  });
  if (res.count === 0) throw new Error("Tidak ditemukan.");
  revalidate();
}
