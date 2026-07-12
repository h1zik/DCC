"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePersonalOwnerId } from "@/lib/personal-space";

/**
 * Bookmark Space Pribadi. Semua query difilter `ownerId` — TANPA bypass
 * peran. Mutasi memakai updateMany/deleteMany `{ id, ownerId }` sehingga
 * id milik user lain berperilaku sama dengan id yang tidak ada
 * ("Tidak ditemukan." — tidak membocorkan keberadaan data).
 */

const bookmarkSchema = z.object({
  id: z.string().cuid().optional(),
  title: z.string().trim().min(1, "Judul wajib diisi.").max(160),
  url: z.string().trim().url("URL tidak valid.").max(800),
  description: z.string().trim().max(2000).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(12).optional(),
});

function normalizeTags(tags: string[] | undefined): string[] {
  if (!tags?.length) return [];
  return [...new Set(tags.map((t) => t.trim()).filter(Boolean))];
}

export async function upsertPersonalBookmark(input: {
  id?: string;
  title: string;
  url: string;
  description?: string | null;
  tags?: string[];
}) {
  const ownerId = await requirePersonalOwnerId();
  const data = bookmarkSchema.parse(input);
  const tags = normalizeTags(data.tags);

  if (data.id) {
    const res = await prisma.personalBookmark.updateMany({
      where: { id: data.id, ownerId },
      data: {
        title: data.title,
        url: data.url,
        description: data.description ?? null,
        tags,
      },
    });
    if (res.count === 0) throw new Error("Tidak ditemukan.");
  } else {
    await prisma.personalBookmark.create({
      data: {
        ownerId,
        title: data.title,
        url: data.url,
        description: data.description ?? null,
        tags,
      },
    });
  }
  revalidatePath("/personal/bookmarks");
}

export async function deletePersonalBookmark(id: string) {
  const ownerId = await requirePersonalOwnerId();
  const res = await prisma.personalBookmark.deleteMany({
    where: { id: z.string().cuid().parse(id), ownerId },
  });
  if (res.count === 0) throw new Error("Tidak ditemukan.");
  revalidatePath("/personal/bookmarks");
}
