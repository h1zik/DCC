"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePersonalOwnerId } from "@/lib/personal-space";
import { removePersonalFileBestEffort } from "@/lib/personal-file-storage";

/**
 * Metadata file & folder Space Pribadi (upload/download byte lewat route
 * `/api/personal/files`). Semua query difilter `ownerId` — TANPA bypass
 * peran. Id milik user lain ⇒ "Tidak ditemukan.".
 */

function revalidate() {
  revalidatePath("/personal/files");
}

export async function createPersonalFolder(input: {
  name: string;
  parentId?: string | null;
}) {
  const ownerId = await requirePersonalOwnerId();
  const data = z
    .object({
      name: z.string().trim().min(1, "Nama folder wajib diisi.").max(120),
      parentId: z.string().cuid().nullable().optional(),
    })
    .parse(input);
  const parentId = data.parentId ?? null;
  if (parentId) {
    const parent = await prisma.personalFileFolder.findFirst({
      where: { id: parentId, ownerId },
      select: { id: true },
    });
    if (!parent) throw new Error("Tidak ditemukan.");
  }
  try {
    await prisma.personalFileFolder.create({
      data: { ownerId, parentId, name: data.name },
    });
  } catch {
    throw new Error("Nama folder sudah dipakai di lokasi ini.");
  }
  revalidate();
}

export async function renamePersonalFolder(input: { id: string; name: string }) {
  const ownerId = await requirePersonalOwnerId();
  const data = z
    .object({
      id: z.string().cuid(),
      name: z.string().trim().min(1, "Nama folder wajib diisi.").max(120),
    })
    .parse(input);
  const res = await prisma.personalFileFolder.updateMany({
    where: { id: data.id, ownerId },
    data: { name: data.name },
  });
  if (res.count === 0) throw new Error("Tidak ditemukan.");
  revalidate();
}

/**
 * Hapus folder + seluruh subfolder (cascade) berikut file di dalamnya.
 * File dikumpulkan dulu (BFS) agar file fisiknya ikut dihapus dari disk.
 */
export async function deletePersonalFolder(id: string) {
  const ownerId = await requirePersonalOwnerId();
  const folderId = z.string().cuid().parse(id);
  const root = await prisma.personalFileFolder.findFirst({
    where: { id: folderId, ownerId },
    select: { id: true },
  });
  if (!root) throw new Error("Tidak ditemukan.");

  const folderIds: string[] = [root.id];
  let frontier = [root.id];
  while (frontier.length > 0) {
    const children = await prisma.personalFileFolder.findMany({
      where: { ownerId, parentId: { in: frontier } },
      select: { id: true },
    });
    frontier = children.map((c) => c.id);
    folderIds.push(...frontier);
  }

  const files = await prisma.personalFile.findMany({
    where: { ownerId, folderId: { in: folderIds } },
    select: { id: true, storagePath: true },
  });

  await prisma.$transaction([
    prisma.personalFile.deleteMany({
      where: { ownerId, folderId: { in: folderIds } },
    }),
    prisma.personalFileFolder.deleteMany({
      where: { id: root.id, ownerId },
    }),
  ]);

  for (const f of files) {
    await removePersonalFileBestEffort(f.storagePath);
  }
  revalidate();
}

export async function renamePersonalFile(input: { id: string; fileName: string }) {
  const ownerId = await requirePersonalOwnerId();
  const data = z
    .object({
      id: z.string().cuid(),
      fileName: z.string().trim().min(1, "Nama file wajib diisi.").max(240),
    })
    .parse(input);
  const res = await prisma.personalFile.updateMany({
    where: { id: data.id, ownerId },
    data: { fileName: data.fileName },
  });
  if (res.count === 0) throw new Error("Tidak ditemukan.");
  revalidate();
}

export async function movePersonalFile(input: {
  id: string;
  folderId: string | null;
}) {
  const ownerId = await requirePersonalOwnerId();
  const data = z
    .object({
      id: z.string().cuid(),
      folderId: z.string().cuid().nullable(),
    })
    .parse(input);
  if (data.folderId) {
    const folder = await prisma.personalFileFolder.findFirst({
      where: { id: data.folderId, ownerId },
      select: { id: true },
    });
    if (!folder) throw new Error("Tidak ditemukan.");
  }
  const res = await prisma.personalFile.updateMany({
    where: { id: data.id, ownerId },
    data: { folderId: data.folderId },
  });
  if (res.count === 0) throw new Error("Tidak ditemukan.");
  revalidate();
}

export async function deletePersonalFile(id: string) {
  const ownerId = await requirePersonalOwnerId();
  const fileId = z.string().cuid().parse(id);
  const file = await prisma.personalFile.findFirst({
    where: { id: fileId, ownerId },
    select: { id: true, storagePath: true },
  });
  if (!file) throw new Error("Tidak ditemukan.");
  await prisma.personalFile.delete({ where: { id: file.id } });
  await removePersonalFileBestEffort(file.storagePath);
  revalidate();
}
