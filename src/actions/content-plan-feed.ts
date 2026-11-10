"use server";

import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { ContentPlanFeedVisibility } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  absolutePathFromStoredPublicPath,
  getUploadPublicDir,
} from "@/lib/upload-storage";
import { requireTasksRoomHubSession } from "@/lib/auth-helpers";
import { assertRoomMember } from "@/lib/room-access";
import { resolveContentPlanViewId, revalidateContentPlan } from "@/lib/content-plan-scope";

/**
 * Simulasi feed Instagram di Content Plan.
 *
 * Dua kelompok data:
 *  - Profil feed per content plan (`RoomContentPlanFeedProfile`): identitas akun
 *    tiruan + preferensi baris mana yang ikut tampil. `viewId` null = content
 *    plan bawaan ruangan, terisi = view tambahan.
 *  - Per baris (`RoomContentPlanItem`): pilihan cover grid dan flag sembunyi.
 *
 * Semua anggota ruangan boleh mengubah — sama dengan kolom content plan lain.
 */

const FEED_AVATAR_MAX_BYTES = 8 * 1024 * 1024;
const FEED_COVER_MAX_BYTES = 20 * 1024 * 1024;

function assertImageMime(mime: string) {
  if (!(mime || "").toLowerCase().startsWith("image/")) {
    throw new Error("File harus berupa gambar (PNG, JPG, WebP, dsb).");
  }
}

function sanitizeBaseName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "file";
}

async function unlinkOwned(publicPath: string | null | undefined, prefix: string) {
  if (!publicPath?.startsWith(prefix)) return;
  const abs = absolutePathFromStoredPublicPath(publicPath);
  if (!abs) return;
  try {
    await unlink(abs);
  } catch {
    /* sudah hilang */
  }
}

async function assertMember(roomId: string) {
  const session = await requireTasksRoomHubSession();
  await assertRoomMember(roomId, session.user.id);
  return session;
}

async function assertItemInRoom(roomId: string, itemId: string) {
  await assertMember(roomId);
  const item = await prisma.roomContentPlanItem.findUniqueOrThrow({
    where: { id: itemId },
    select: { roomId: true, designFilePaths: true, feedCoverPath: true },
  });
  if (item.roomId !== roomId) {
    throw new Error("Item tidak termasuk ruangan ini.");
  }
  return item;
}

function revalidateFeed(roomId: string) {
  revalidateContentPlan(roomId);
}

/* ------------------------------------------------------------------ */
/* Profil feed                                                          */
/* ------------------------------------------------------------------ */

const profileSchema = z.object({
  username: z
    .string()
    .trim()
    .max(60, "Username maksimal 60 karakter.")
    .regex(/^[a-zA-Z0-9._]*$/, "Username hanya huruf, angka, titik, dan garis bawah.")
    .optional(),
  displayName: z.string().trim().max(80, "Nama maksimal 80 karakter.").optional(),
  bio: z.string().trim().max(400, "Bio maksimal 400 karakter.").optional(),
  followersLabel: z.string().trim().max(20).optional(),
  followingLabel: z.string().trim().max(20).optional(),
  includeArchived: z.boolean().optional(),
  instagramOnly: z.boolean().optional(),
  includeUndated: z.boolean().optional(),
});

export type ContentPlanFeedProfileInput = z.infer<typeof profileSchema>;

/** Profil feed milik satu content plan (bawaan ruangan bila `viewId` null). */
async function findFeedProfile(roomId: string, viewId: string | null) {
  return viewId
    ? prisma.roomContentPlanFeedProfile.findUnique({ where: { viewId } })
    : prisma.roomContentPlanFeedProfile.findFirst({
        where: { roomId, viewId: null },
        orderBy: { createdAt: "asc" },
      });
}

/** Perbarui profil feed sebuah content plan; dibuat dulu bila belum ada. */
async function upsertFeedProfile(
  roomId: string,
  viewId: string | null,
  data: ContentPlanFeedProfileInput & { avatarPath?: string | null },
) {
  const existing = await findFeedProfile(roomId, viewId);
  if (existing) {
    return prisma.roomContentPlanFeedProfile.update({
      where: { id: existing.id },
      data,
    });
  }
  return prisma.roomContentPlanFeedProfile.create({
    data: { roomId, viewId, ...data },
  });
}

/** Simpan sebagian/semua field profil feed content plan (buat bila belum ada). */
export async function saveContentPlanFeedProfile(
  roomId: string,
  input: ContentPlanFeedProfileInput,
  viewId?: string | null,
) {
  await assertMember(roomId);
  const planViewId = await resolveContentPlanViewId(roomId, viewId);
  const data = profileSchema.parse(input);
  const clean = Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== undefined),
  ) as ContentPlanFeedProfileInput;
  const row = await upsertFeedProfile(roomId, planViewId, clean);
  revalidateFeed(roomId);
  return row;
}

export async function uploadContentPlanFeedAvatar(
  roomId: string,
  formData: FormData,
  viewId?: string | null,
) {
  await assertMember(roomId);
  const planViewId = await resolveContentPlanViewId(roomId, viewId);
  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    throw new Error("Pilih file avatar.");
  }
  if (file.size > FEED_AVATAR_MAX_BYTES) {
    throw new Error("Ukuran avatar maksimal 8 MB.");
  }
  assertImageMime(file.type);

  const prev = await findFeedProfile(roomId, planViewId);

  const ext = path.extname(file.name).slice(0, 10).toLowerCase() || ".png";
  const base = sanitizeBaseName(path.basename(file.name, path.extname(file.name)));
  const stored = `avatar-${randomUUID()}-${base}${ext}`;
  const dir = path.join(getUploadPublicDir(), "room-content-plan-feed", roomId);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, stored), Buffer.from(await file.arrayBuffer()));
  const publicPath = `/uploads/room-content-plan-feed/${roomId}/${stored}`;

  await upsertFeedProfile(roomId, planViewId, { avatarPath: publicPath });
  await unlinkOwned(prev?.avatarPath, `/uploads/room-content-plan-feed/${roomId}/`);
  revalidateFeed(roomId);
  return { avatarPath: publicPath };
}

export async function clearContentPlanFeedAvatar(roomId: string, viewId?: string | null) {
  await assertMember(roomId);
  const planViewId = await resolveContentPlanViewId(roomId, viewId);
  const prev = await findFeedProfile(roomId, planViewId);
  if (!prev) return;
  await prisma.roomContentPlanFeedProfile.update({
    where: { id: prev.id },
    data: { avatarPath: null },
  });
  await unlinkOwned(prev.avatarPath, `/uploads/room-content-plan-feed/${roomId}/`);
  revalidateFeed(roomId);
}

/* ------------------------------------------------------------------ */
/* Per baris: cover grid & sembunyikan                                  */
/* ------------------------------------------------------------------ */

/** Pilih slide design ke-N sebagai cover grid (menghapus cover kustom bila ada). */
export async function setContentPlanFeedCoverIndex(
  roomId: string,
  itemId: string,
  coverIndex: number,
) {
  const item = await assertItemInRoom(roomId, itemId);
  const idx = z.number().int().min(0).max(99).parse(coverIndex);
  if (item.designFilePaths.length > 0 && idx >= item.designFilePaths.length) {
    throw new Error("Slide yang dipilih tidak ada.");
  }
  await prisma.roomContentPlanItem.update({
    where: { id: itemId },
    data: { feedCoverIndex: idx, feedCoverPath: null },
  });
  await unlinkOwned(item.feedCoverPath, `/uploads/room-content-plan/${itemId}/`);
  revalidateFeed(roomId);
}

/** Unggah gambar cover kustom (mis. thumbnail reels) untuk grid feed. */
export async function uploadContentPlanFeedCover(
  roomId: string,
  itemId: string,
  formData: FormData,
) {
  const item = await assertItemInRoom(roomId, itemId);
  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    throw new Error("Pilih file cover.");
  }
  if (file.size > FEED_COVER_MAX_BYTES) {
    throw new Error("Ukuran cover maksimal 20 MB.");
  }
  assertImageMime(file.type);

  const ext = path.extname(file.name).slice(0, 10).toLowerCase() || ".png";
  const base = sanitizeBaseName(path.basename(file.name, path.extname(file.name)));
  const stored = `feedcover-${randomUUID()}-${base}${ext}`;
  const dir = path.join(getUploadPublicDir(), "room-content-plan", itemId);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, stored), Buffer.from(await file.arrayBuffer()));
  const publicPath = `/uploads/room-content-plan/${itemId}/${stored}`;

  await prisma.roomContentPlanItem.update({
    where: { id: itemId },
    data: { feedCoverPath: publicPath },
  });
  await unlinkOwned(item.feedCoverPath, `/uploads/room-content-plan/${itemId}/`);
  revalidateFeed(roomId);
  return { feedCoverPath: publicPath };
}

export async function clearContentPlanFeedCover(roomId: string, itemId: string) {
  const item = await assertItemInRoom(roomId, itemId);
  await prisma.roomContentPlanItem.update({
    where: { id: itemId },
    data: { feedCoverPath: null },
  });
  await unlinkOwned(item.feedCoverPath, `/uploads/room-content-plan/${itemId}/`);
  revalidateFeed(roomId);
}

/** AUTO ikut aturan profil, SHOWN selalu tampil, HIDDEN tidak pernah tampil. */
export async function setContentPlanFeedVisibility(
  roomId: string,
  itemId: string,
  visibility: ContentPlanFeedVisibility,
) {
  await assertItemInRoom(roomId, itemId);
  const v = z.nativeEnum(ContentPlanFeedVisibility).parse(visibility);
  await prisma.roomContentPlanItem.update({
    where: { id: itemId },
    data: { feedVisibility: v },
  });
  revalidateFeed(roomId);
}

/* ------------------------------------------------------------------ */
/* Urutan manual grid                                                   */
/* ------------------------------------------------------------------ */

const reorderSchema = z.array(z.string().min(1)).min(1).max(2000);

/**
 * Simpan posisi manual untuk tile yang sedang tampil (index = posisi dari kiri
 * atas). Baris yang tidak ada di daftar dibiarkan (tetap otomatis / posisi lama).
 */
export async function reorderContentPlanFeed(roomId: string, orderedIds: string[]) {
  await assertMember(roomId);
  const ids = [...new Set(reorderSchema.parse(orderedIds))];
  const owned = await prisma.roomContentPlanItem.count({
    where: { roomId, id: { in: ids } },
  });
  if (owned !== ids.length) {
    throw new Error("Ada baris yang bukan milik ruangan ini.");
  }
  await prisma.$transaction(
    ids.map((id, index) =>
      prisma.roomContentPlanItem.updateMany({
        where: { id, roomId },
        data: { feedPosition: index },
      }),
    ),
  );
  revalidateFeed(roomId);
}

/** Kembalikan seluruh grid satu content plan ke urutan otomatis (tanggal & jam posting). */
export async function resetContentPlanFeedOrder(roomId: string, viewId?: string | null) {
  await assertMember(roomId);
  const result = await prisma.roomContentPlanItem.updateMany({
    where: { roomId, viewId: viewId ?? null, feedPosition: { not: null } },
    data: { feedPosition: null },
  });
  revalidateFeed(roomId);
  return { updated: result.count };
}
