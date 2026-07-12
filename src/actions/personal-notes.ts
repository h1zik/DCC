"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePersonalOwnerId } from "@/lib/personal-space";
import { normalizeWikiTags, WIKI_TAG_LIMITS } from "@/lib/wiki-organization";

/**
 * Catatan Space Pribadi. Semua query difilter `ownerId` — TANPA bypass
 * peran. Kontrak konflik autosave meniru `upsertRoomWikiPage`
 * (guard `revision`), minus edit-lock/presence/version karena single-user.
 */

const upsertSchema = z.object({
  id: z.string().cuid().optional(),
  title: z.string().trim().min(1, "Judul wajib diisi.").max(160),
  content: z.string().max(200_000).optional().default(""),
  baseRevision: z.number().int().min(0).optional(),
  parentId: z.string().cuid().nullable().optional(),
});

type SaveConflict = {
  conflict: true;
  id: string;
  revision: number;
  title: string;
  content: string;
  updatedAt: string;
};

function revalidate() {
  revalidatePath("/personal/notes");
}

export async function upsertPersonalNote(input: {
  id?: string;
  title: string;
  content?: string;
  baseRevision?: number;
  parentId?: string | null;
}) {
  const ownerId = await requirePersonalOwnerId();
  const data = upsertSchema.parse(input);

  if (data.id) {
    const current = await prisma.personalNote.findFirst({
      where: { id: data.id, ownerId },
      select: {
        id: true,
        title: true,
        content: true,
        revision: true,
        updatedAt: true,
      },
    });
    if (!current) throw new Error("Tidak ditemukan.");
    if (data.baseRevision != null && data.baseRevision !== current.revision) {
      return {
        conflict: true,
        id: current.id,
        revision: current.revision,
        title: current.title,
        content: current.content,
        updatedAt: current.updatedAt.toISOString(),
      } satisfies SaveConflict;
    }
    if (current.title === data.title && current.content === data.content) {
      return {
        conflict: false as const,
        id: current.id,
        revision: current.revision,
        updatedAt: current.updatedAt.toISOString(),
      };
    }

    const nextRevision = current.revision + 1;
    const guarded = await prisma.personalNote.updateMany({
      where: { id: current.id, ownerId, revision: current.revision },
      data: {
        title: data.title,
        content: data.content,
        revision: nextRevision,
      },
    });
    if (guarded.count !== 1) {
      const latest = await prisma.personalNote.findFirst({
        where: { id: current.id, ownerId },
        select: {
          id: true,
          revision: true,
          title: true,
          content: true,
          updatedAt: true,
        },
      });
      if (!latest) throw new Error("Tidak ditemukan.");
      return {
        conflict: true,
        id: latest.id,
        revision: latest.revision,
        title: latest.title,
        content: latest.content,
        updatedAt: latest.updatedAt.toISOString(),
      } satisfies SaveConflict;
    }
    const updated = await prisma.personalNote.findUniqueOrThrow({
      where: { id: current.id },
      select: { revision: true, updatedAt: true },
    });
    revalidate();
    return {
      conflict: false as const,
      id: current.id,
      revision: updated.revision,
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  const parentId = data.parentId ?? null;
  if (parentId) {
    const parent = await prisma.personalNote.findFirst({
      where: { id: parentId, ownerId },
      select: { id: true },
    });
    if (!parent) throw new Error("Catatan induk tidak valid.");
  }
  const max = await prisma.personalNote.aggregate({
    where: { ownerId, parentId },
    _max: { sortOrder: true },
  });
  const created = await prisma.personalNote.create({
    data: {
      ownerId,
      parentId,
      title: data.title,
      content: data.content,
      sortOrder: (max._max.sortOrder ?? -1) + 1,
    },
    select: { id: true, revision: true, updatedAt: true },
  });
  revalidate();
  return {
    conflict: false as const,
    id: created.id,
    revision: created.revision,
    updatedAt: created.updatedAt.toISOString(),
  };
}

export async function updatePersonalNoteOrganization(input: {
  id: string;
  parentId?: string | null;
  tags?: string[];
}) {
  const ownerId = await requirePersonalOwnerId();
  const data = z
    .object({
      id: z.string().cuid(),
      parentId: z.string().cuid().nullable().optional(),
      tags: z
        .array(z.string().max(WIKI_TAG_LIMITS.maxLength))
        .max(WIKI_TAG_LIMITS.maxTags)
        .optional(),
    })
    .parse(input);

  if (data.parentId !== undefined && data.parentId !== null) {
    if (data.parentId === data.id) {
      throw new Error("Catatan tidak bisa menjadi induk dirinya sendiri.");
    }
    // Validasi induk milik user + tolak siklus (walk-up rantai parent).
    let cursor: string | null = data.parentId;
    let hops = 0;
    while (cursor) {
      const node: { id: string; parentId: string | null } | null =
        await prisma.personalNote.findFirst({
          where: { id: cursor, ownerId },
          select: { id: true, parentId: true },
        });
      if (!node) throw new Error("Catatan induk tidak valid.");
      if (node.parentId === data.id) {
        throw new Error("Struktur induk melingkar tidak diizinkan.");
      }
      cursor = node.parentId;
      hops += 1;
      if (hops > 50) throw new Error("Struktur catatan terlalu dalam.");
    }
  }

  const res = await prisma.personalNote.updateMany({
    where: { id: data.id, ownerId },
    data: {
      ...(data.parentId !== undefined ? { parentId: data.parentId } : {}),
      ...(data.tags !== undefined ? { tags: normalizeWikiTags(data.tags) } : {}),
    },
  });
  if (res.count === 0) throw new Error("Tidak ditemukan.");
  revalidate();
}

/** Hapus catatan; anak-anaknya naik ke root (onDelete: SetNull di schema). */
export async function deletePersonalNote(id: string) {
  const ownerId = await requirePersonalOwnerId();
  const res = await prisma.personalNote.deleteMany({
    where: { id: z.string().cuid().parse(id), ownerId },
  });
  if (res.count === 0) throw new Error("Tidak ditemukan.");
  revalidate();
}
