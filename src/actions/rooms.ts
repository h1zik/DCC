"use server";

import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { RoomWorkspaceSection } from "@prisma/client";
import { revalidateTasksAndRoomHub } from "@/lib/revalidate-workspace";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireCeoOrAdministrator, requireTasksRoomHubSession } from "@/lib/auth-helpers";
import { ensureSimpleRoomBoardProject } from "@/lib/room-simple-hub";
import { assertRoomHubManager } from "@/lib/room-access";
import {
  absolutePathFromStoredPublicPath,
  getUploadPublicDir,
} from "@/lib/upload-storage";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from "@/lib/upload-limits";

const roomSchema = z.object({
  name: z.string().min(1),
  brandId: z.string().optional().nullable(),
  workspaceSection: z
    .nativeEnum(RoomWorkspaceSection)
    .default(RoomWorkspaceSection.ROOMS),
});

export async function createRoom(input: z.infer<typeof roomSchema>) {
  await requireCeoOrAdministrator();
  const data = roomSchema.parse(input);
  const created = await prisma.room.create({
    data: {
      name: data.name,
      brandId: data.brandId || null,
      workspaceSection: data.workspaceSection,
    },
  });
  await ensureSimpleRoomBoardProject(created.id);
  revalidatePath("/rooms");
  revalidateTasksAndRoomHub();
  revalidatePath("/projects");
}

export async function updateRoom(
  id: string,
  input: z.infer<typeof roomSchema>,
) {
  await requireCeoOrAdministrator();
  const data = roomSchema.parse(input);
  await prisma.room.update({
    where: { id },
    data: {
      name: data.name,
      brandId: data.brandId || null,
      workspaceSection: data.workspaceSection,
    },
  });
  await ensureSimpleRoomBoardProject(id);
  revalidatePath("/rooms");
  revalidateTasksAndRoomHub();
  revalidatePath("/projects");
}

export async function deleteRoom(id: string) {
  await requireCeoOrAdministrator();
  const count = await prisma.project.count({ where: { roomId: id } });
  if (count > 0) {
    throw new Error(
      "Ruangan masih memiliki proyek. Pindahkan atau hapus proyek terlebih dahulu.",
    );
  }
  await prisma.room.delete({ where: { id } });
  revalidatePath("/rooms");
  revalidateTasksAndRoomHub();
}

function sanitizeBaseName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "image";
}

function assertAllowedBannerMime(mime: string): void {
  const m = (mime || "application/octet-stream").toLowerCase();
  if (m.startsWith("image/")) return;
  throw new Error("Banner harus berupa file gambar.");
}

function assertAllowedLogoMime(mime: string): void {
  const m = (mime || "application/octet-stream").toLowerCase();
  if (m.startsWith("image/")) return;
  throw new Error("Logo harus berupa file gambar.");
}

async function removeBannerIfOwned(publicPath: string | null, roomId: string) {
  if (!publicPath) return;
  if (!publicPath.startsWith(`/uploads/rooms/${roomId}/`)) return;
  const abs = absolutePathFromStoredPublicPath(publicPath);
  if (!abs) return;
  try {
    await unlink(abs);
  } catch {
    /* file mungkin sudah tidak ada */
  }
}

export async function uploadRoomBanner(roomId: string, formData: FormData) {
  const session = await requireTasksRoomHubSession();
  await assertRoomHubManager(roomId, session.user.id);
  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    throw new Error("Pilih file banner terlebih dahulu.");
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(`Ukuran file maksimal ${MAX_UPLOAD_LABEL}.`);
  }
  const mime = file.type || "application/octet-stream";
  assertAllowedBannerMime(mime);

  const room = await prisma.room.findUniqueOrThrow({
    where: { id: roomId },
    select: { bannerImage: true },
  });

  const ext = path.extname(file.name).slice(0, 10).toLowerCase() || ".jpg";
  const base = sanitizeBaseName(path.basename(file.name, path.extname(file.name)));
  const stored = `${randomUUID()}-${base}${ext}`;
  const dir = path.join(getUploadPublicDir(), "rooms", roomId, "banners");
  await mkdir(dir, { recursive: true });
  const absFile = path.join(dir, stored);
  const buf = Buffer.from(await file.arrayBuffer());
  await writeFile(absFile, buf);
  const nextPublicPath = `/uploads/rooms/${roomId}/banners/${stored}`;

  await prisma.room.update({
    where: { id: roomId },
    data: { bannerImage: nextPublicPath },
  });
  await removeBannerIfOwned(room.bannerImage, roomId);

  revalidateTasksAndRoomHub();
  revalidatePath("/rooms");
  revalidatePath(`/room/${roomId}`);
}

export async function clearRoomBanner(roomId: string) {
  const session = await requireTasksRoomHubSession();
  await assertRoomHubManager(roomId, session.user.id);

  const room = await prisma.room.findUniqueOrThrow({
    where: { id: roomId },
    select: { bannerImage: true },
  });
  await prisma.room.update({
    where: { id: roomId },
    data: { bannerImage: null },
  });
  await removeBannerIfOwned(room.bannerImage, roomId);

  revalidateTasksAndRoomHub();
  revalidatePath("/rooms");
  revalidatePath(`/room/${roomId}`);
}

export async function uploadRoomLogo(roomId: string, formData: FormData) {
  const session = await requireTasksRoomHubSession();
  await assertRoomHubManager(roomId, session.user.id);
  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    throw new Error("Pilih file logo terlebih dahulu.");
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(`Ukuran file maksimal ${MAX_UPLOAD_LABEL}.`);
  }
  const mime = file.type || "application/octet-stream";
  assertAllowedLogoMime(mime);

  const room = await prisma.room.findUniqueOrThrow({
    where: { id: roomId },
    select: { logoImage: true },
  });

  const ext = path.extname(file.name).slice(0, 10).toLowerCase() || ".png";
  const base = sanitizeBaseName(path.basename(file.name, path.extname(file.name)));
  const stored = `${randomUUID()}-${base}${ext}`;
  const dir = path.join(getUploadPublicDir(), "rooms", roomId, "logos");
  await mkdir(dir, { recursive: true });
  const absFile = path.join(dir, stored);
  const buf = Buffer.from(await file.arrayBuffer());
  await writeFile(absFile, buf);
  const nextPublicPath = `/uploads/rooms/${roomId}/logos/${stored}`;

  await prisma.room.update({
    where: { id: roomId },
    data: { logoImage: nextPublicPath },
  });
  await removeBannerIfOwned(room.logoImage, roomId);

  revalidateTasksAndRoomHub();
  revalidatePath("/rooms");
  revalidatePath(`/room/${roomId}`);
}

export async function clearRoomLogo(roomId: string) {
  const session = await requireTasksRoomHubSession();
  await assertRoomHubManager(roomId, session.user.id);

  const room = await prisma.room.findUniqueOrThrow({
    where: { id: roomId },
    select: { logoImage: true },
  });
  await prisma.room.update({
    where: { id: roomId },
    data: { logoImage: null },
  });
  await removeBannerIfOwned(room.logoImage, roomId);

  revalidateTasksAndRoomHub();
  revalidatePath("/rooms");
  revalidatePath(`/room/${roomId}`);
}
