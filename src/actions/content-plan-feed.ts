"use server";

import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  absolutePathFromStoredPublicPath,
  getUploadPublicDir,
} from "@/lib/upload-storage";
import { requireTasksRoomHubSession } from "@/lib/auth-helpers";
import { assertRoomMember } from "@/lib/room-access";

/**
 * Simulasi feed Instagram di Content Plan.
 *
 * Dua kelompok data:
 *  - Profil feed per ruangan (`RoomContentPlanFeedProfile`): identitas akun
 *    tiruan + preferensi baris mana yang ikut tampil.
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
  revalidatePath(`/room/${roomId}/content-planning`);
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

/** Simpan sebagian/semua field profil feed ruangan (buat bila belum ada). */
export async function saveContentPlanFeedProfile(
  roomId: string,
  input: ContentPlanFeedProfileInput,
) {
  await assertMember(roomId);
  const data = profileSchema.parse(input);
  const clean = Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== undefined),
  ) as ContentPlanFeedProfileInput;
  const row = await prisma.roomContentPlanFeedProfile.upsert({
    where: { roomId },
    create: { roomId, ...clean },
    update: clean,
  });
  revalidateFeed(roomId);
  return row;
}

export async function uploadContentPlanFeedAvatar(roomId: string, formData: FormData) {
  await assertMember(roomId);
  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    throw new Error("Pilih file avatar.");
  }
  if (file.size > FEED_AVATAR_MAX_BYTES) {
    throw new Error("Ukuran avatar maksimal 8 MB.");
  }
  assertImageMime(file.type);

  const prev = await prisma.roomContentPlanFeedProfile.findUnique({
    where: { roomId },
    select: { avatarPath: true },
  });

  const ext = path.extname(file.name).slice(0, 10).toLowerCase() || ".png";
  const base = sanitizeBaseName(path.basename(file.name, path.extname(file.name)));
  const stored = `avatar-${randomUUID()}-${base}${ext}`;
  const dir = path.join(getUploadPublicDir(), "room-content-plan-feed", roomId);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, stored), Buffer.from(await file.arrayBuffer()));
  const publicPath = `/uploads/room-content-plan-feed/${roomId}/${stored}`;

  await prisma.roomContentPlanFeedProfile.upsert({
    where: { roomId },
    create: { roomId, avatarPath: publicPath },
    update: { avatarPath: publicPath },
  });
  await unlinkOwned(prev?.avatarPath, `/uploads/room-content-plan-feed/${roomId}/`);
  revalidateFeed(roomId);
  return { avatarPath: publicPath };
}

export async function clearContentPlanFeedAvatar(roomId: string) {
  await assertMember(roomId);
  const prev = await prisma.roomContentPlanFeedProfile.findUnique({
    where: { roomId },
    select: { avatarPath: true },
  });
  if (!prev) return;
  await prisma.roomContentPlanFeedProfile.update({
    where: { roomId },
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

export async function setContentPlanFeedHidden(
  roomId: string,
  itemId: string,
  hidden: boolean,
) {
  await assertItemInRoom(roomId, itemId);
  await prisma.roomContentPlanItem.update({
    where: { id: itemId },
    data: { hiddenFromFeed: hidden },
  });
  revalidateFeed(roomId);
}
