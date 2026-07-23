"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePersonalOwnerId } from "@/lib/personal-space";
import { normalizeWikiTags, WIKI_TAG_LIMITS } from "@/lib/wiki-organization";

/**
 * Catatan Space Pribadi. Semua query difilter `ownerId` — TANPA bypass
 * peran. Kontrak konflik autosave + checkpoint versi meniru
 * `upsertRoomWikiPage`, minus edit-lock/presence/komentar karena single-user.
 */

const upsertSchema = z.object({
  id: z.string().cuid().optional(),
  title: z.string().trim().min(1, "Judul wajib diisi.").max(160),
  content: z.string().max(200_000).optional().default(""),
  baseRevision: z.number().int().min(0).optional(),
  parentId: z.string().cuid().nullable().optional(),
});

const VERSION_CHECKPOINT_MS = 60_000;

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

    const latestVersion = await prisma.personalNoteVersion.findFirst({
      where: { noteId: current.id, ownerId },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    const nextRevision = current.revision + 1;
    const shouldCheckpoint =
      !latestVersion ||
      Date.now() - latestVersion.createdAt.getTime() >= VERSION_CHECKPOINT_MS;

    const guarded = await prisma.$transaction(async (tx) => {
      const res = await tx.personalNote.updateMany({
        where: { id: current.id, ownerId, revision: current.revision },
        data: {
          title: data.title,
          content: data.content,
          revision: nextRevision,
        },
      });
      if (res.count === 1 && shouldCheckpoint) {
        await tx.personalNoteVersion.create({
          data: {
            noteId: current.id,
            ownerId,
            revision: nextRevision,
            title: data.title,
            content: data.content,
          },
        });
      }
      return res;
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
      versions: {
        create: {
          ownerId,
          revision: 0,
          title: data.title,
          content: data.content ?? "",
          reason: "initial",
        },
      },
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

export async function listPersonalNoteVersions(noteId: string) {
  const ownerId = await requirePersonalOwnerId();
  const versions = await prisma.personalNoteVersion.findMany({
    where: { noteId: z.string().cuid().parse(noteId), ownerId },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      revision: true,
      title: true,
      content: true,
      reason: true,
      createdAt: true,
    },
  });
  return versions.map((version) => ({
    ...version,
    createdAt: version.createdAt.toISOString(),
  }));
}

export async function restorePersonalNoteVersion(
  noteId: string,
  versionId: string,
) {
  const ownerId = await requirePersonalOwnerId();
  const note = await prisma.personalNote.findFirst({
    where: { id: z.string().cuid().parse(noteId), ownerId },
    select: { id: true, revision: true },
  });
  if (!note) throw new Error("Tidak ditemukan.");
  const version = await prisma.personalNoteVersion.findFirst({
    where: { id: z.string().cuid().parse(versionId), noteId: note.id, ownerId },
    select: { title: true, content: true },
  });
  if (!version) throw new Error("Versi catatan tidak ditemukan.");
  const nextRevision = note.revision + 1;
  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.personalNote.update({
      where: { id: note.id },
      data: {
        title: version.title,
        content: version.content,
        revision: nextRevision,
      },
      select: { updatedAt: true },
    });
    await tx.personalNoteVersion.create({
      data: {
        noteId: note.id,
        ownerId,
        revision: nextRevision,
        title: version.title,
        content: version.content,
        reason: "restore",
      },
    });
    return row;
  });
  revalidate();
  return { revision: nextRevision, updatedAt: updated.updatedAt.toISOString() };
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
