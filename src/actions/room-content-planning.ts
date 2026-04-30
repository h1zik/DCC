"use server";

import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { ContentPlanJenis, ContentPlanStatusKerja } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  absolutePathFromStoredPublicPath,
  getUploadPublicDir,
} from "@/lib/upload-storage";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from "@/lib/upload-limits";
import { requireTasksRoomHubSession } from "@/lib/auth-helpers";
import { assertRoomMember } from "@/lib/room-access";
import { revalidateTasksAndRoomHub } from "@/lib/revalidate-workspace";

const MAX_DESIGN_SLIDES = 24;
const ALLOWED_PREFIXES = [
  "image/",
  "application/pdf",
  "text/",
  "application/msword",
  "application/vnd.openxmlformats-officedocument",
  "application/zip",
  "video/",
  "audio/",
];

function isAllowedMime(mime: string): boolean {
  const m = (mime || "application/octet-stream").toLowerCase();
  return ALLOWED_PREFIXES.some((p) => m.startsWith(p));
}

function sanitizeBaseName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "file";
}

async function unlinkIfSafe(absPublicPath: string | null | undefined) {
  if (!absPublicPath?.startsWith("/uploads/room-content-plan/")) return;
  const absFile = absolutePathFromStoredPublicPath(absPublicPath);
  try {
    if (absFile) await unlink(absFile);
  } catch {
    /* sudah hilang */
  }
}

async function assertPicInRoom(roomId: string, picUserId: string | null) {
  if (!picUserId) return;
  const m = await prisma.roomMember.findUnique({
    where: { roomId_userId: { roomId, userId: picUserId } },
  });
  if (!m) {
    throw new Error("PIC harus dipilih dari anggota ruangan ini.");
  }
}

async function assertPicsInRoom(roomId: string, picUserIds: string[]) {
  if (!picUserIds.length) return;
  const uniqueIds = [...new Set(picUserIds.filter(Boolean))];
  const count = await prisma.roomMember.count({
    where: {
      roomId,
      userId: { in: uniqueIds },
    },
  });
  if (count !== uniqueIds.length) {
    throw new Error("PIC harus dipilih dari anggota ruangan ini.");
  }
}

async function assertItemRoom(roomId: string, itemId: string) {
  const session = await requireTasksRoomHubSession();
  await assertRoomMember(roomId, session.user.id);
  const item = await prisma.roomContentPlanItem.findUniqueOrThrow({
    where: { id: itemId },
    select: { roomId: true },
  });
  if (item.roomId !== roomId) {
    throw new Error("Item tidak termasuk ruangan ini.");
  }
}

/** Reels / Single feed: hanya satu file design aktif. */
async function normalizeDesignPathsForNonCarousel(itemId: string) {
  const row = await prisma.roomContentPlanItem.findUnique({
    where: { id: itemId },
    select: { jenisKonten: true, designFilePaths: true },
  });
  if (!row || row.jenisKonten === ContentPlanJenis.CAROUSEL) return;
  if (row.designFilePaths.length <= 1) return;
  const [first, ...rest] = row.designFilePaths;
  for (const p of rest) await unlinkIfSafe(p);
  await prisma.roomContentPlanItem.update({
    where: { id: itemId },
    data: { designFilePaths: first ? [first] : [] },
  });
}

const upsertSchema = z.object({
  id: z.string().optional(),
  roomId: z.string().min(1),
  konten: z.string().min(1),
  jenisKonten: z.nativeEnum(ContentPlanJenis),
  detailKonten: z.string().optional().nullable(),
  copywritingLink: z.string().optional().nullable(),
  designLink: z.string().optional().nullable(),
  picUserId: z.string().optional().nullable(),
  picUserIds: z.array(z.string()).optional().default([]),
  statusCopywriting: z.nativeEnum(ContentPlanStatusKerja),
  statusDesign: z.nativeEnum(ContentPlanStatusKerja),
  deadlineCopywriting: z.coerce.date().optional().nullable(),
  deadlineDesign: z.coerce.date().optional().nullable(),
  tanggalPosting: z.coerce.date().optional().nullable(),
  catatan: z.string().optional().nullable(),
});

export async function upsertRoomContentPlanItem(
  input: z.infer<typeof upsertSchema>,
): Promise<{ id: string }> {
  const session = await requireTasksRoomHubSession();
  const data = upsertSchema.parse(input);
  await assertRoomMember(data.roomId, session.user.id);
  const normalizedPicIds = [...new Set((data.picUserIds ?? []).filter(Boolean))];
  const fallbackPicId =
    normalizedPicIds[0] ?? (data.picUserId && data.picUserId.trim() ? data.picUserId : null);
  await assertPicInRoom(data.roomId, fallbackPicId);
  await assertPicsInRoom(data.roomId, normalizedPicIds);

  if (data.id) {
    const existing = await prisma.roomContentPlanItem.findUniqueOrThrow({
      where: { id: data.id },
      select: { roomId: true },
    });
    if (existing.roomId !== data.roomId) {
      throw new Error("Item tidak termasuk ruangan ini.");
    }
    await prisma.roomContentPlanItem.update({
      where: { id: data.id },
      data: {
        konten: data.konten,
        jenisKonten: data.jenisKonten,
        detailKonten: data.detailKonten ?? null,
        copywritingLink: data.copywritingLink?.trim() || null,
        designLink: data.designLink?.trim() || null,
        picUserId: fallbackPicId || null,
        picUserIds: normalizedPicIds,
        statusCopywriting: data.statusCopywriting,
        statusDesign: data.statusDesign,
        deadlineCopywriting: data.deadlineCopywriting ?? null,
        deadlineDesign: data.deadlineDesign ?? null,
        tanggalPosting: data.tanggalPosting ?? null,
        catatan: data.catatan?.trim() || null,
      },
    });
    await normalizeDesignPathsForNonCarousel(data.id);
    revalidateTasksAndRoomHub();
    revalidatePath(`/room/${data.roomId}/content-planning`);
    return { id: data.id };
  }

  const max = await prisma.roomContentPlanItem.aggregate({
    where: { roomId: data.roomId },
    _max: { sortOrder: true },
  });
  const created = await prisma.roomContentPlanItem.create({
    data: {
      roomId: data.roomId,
      konten: data.konten,
      jenisKonten: data.jenisKonten,
      detailKonten: data.detailKonten ?? null,
      copywritingLink: data.copywritingLink?.trim() || null,
      designLink: data.designLink?.trim() || null,
      picUserId: fallbackPicId || null,
      picUserIds: normalizedPicIds,
      statusCopywriting: data.statusCopywriting,
      statusDesign: data.statusDesign,
      deadlineCopywriting: data.deadlineCopywriting ?? null,
      deadlineDesign: data.deadlineDesign ?? null,
      tanggalPosting: data.tanggalPosting ?? null,
      catatan: data.catatan?.trim() || null,
      sortOrder: (max._max.sortOrder ?? 0) + 1,
      createdById: session.user.id,
    },
  });
  await normalizeDesignPathsForNonCarousel(created.id);
  revalidateTasksAndRoomHub();
  revalidatePath(`/room/${data.roomId}/content-planning`);
  return { id: created.id };
}

export async function deleteRoomContentPlanItem(roomId: string, itemId: string) {
  const session = await requireTasksRoomHubSession();
  await assertRoomMember(roomId, session.user.id);
  const item = await prisma.roomContentPlanItem.findUniqueOrThrow({
    where: { id: itemId },
    select: {
      roomId: true,
      copywritingFilePath: true,
      designFilePaths: true,
    },
  });
  if (item.roomId !== roomId) {
    throw new Error("Item tidak termasuk ruangan ini.");
  }
  await unlinkIfSafe(item.copywritingFilePath);
  for (const p of item.designFilePaths) {
    await unlinkIfSafe(p);
  }
  await prisma.roomContentPlanItem.delete({ where: { id: itemId } });
  revalidateTasksAndRoomHub();
  revalidatePath(`/room/${roomId}/content-planning`);
}

export async function uploadContentPlanCopywritingFile(
  roomId: string,
  itemId: string,
  formData: FormData,
) {
  await assertItemRoom(roomId, itemId);
  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    throw new Error("Pilih file copywriting.");
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(`Ukuran file maksimal ${MAX_UPLOAD_LABEL}.`);
  }
  const mime = file.type || "application/octet-stream";
  if (!isAllowedMime(mime)) {
    throw new Error("Tipe file tidak diizinkan.");
  }
  const prev = await prisma.roomContentPlanItem.findUniqueOrThrow({
    where: { id: itemId },
    select: { copywritingFilePath: true },
  });
  await unlinkIfSafe(prev.copywritingFilePath);

  const buf = Buffer.from(await file.arrayBuffer());
  const base = sanitizeBaseName(file.name);
  const stored = `copywriting-${randomUUID()}-${base}`;
  const absDir = path.join(getUploadPublicDir(), "room-content-plan", itemId);
  await mkdir(absDir, { recursive: true });
  const absFile = path.join(absDir, stored);
  await writeFile(absFile, buf);
  const publicPath = `/uploads/room-content-plan/${itemId}/${stored}`;
  await prisma.roomContentPlanItem.update({
    where: { id: itemId },
    data: { copywritingFilePath: publicPath },
  });
  revalidateTasksAndRoomHub();
  revalidatePath(`/room/${roomId}/content-planning`);
}

export async function uploadContentPlanDesignFile(
  roomId: string,
  itemId: string,
  formData: FormData,
) {
  await assertItemRoom(roomId, itemId);
  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    throw new Error("Pilih file design.");
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(`Ukuran file maksimal ${MAX_UPLOAD_LABEL}.`);
  }
  const mime = file.type || "application/octet-stream";
  if (!isAllowedMime(mime)) {
    throw new Error("Tipe file tidak diizinkan.");
  }

  const replaceSingle =
    formData.get("replaceSingle") === "true" || formData.get("replaceSingle") === "1";

  const current = await prisma.roomContentPlanItem.findUniqueOrThrow({
    where: { id: itemId },
    select: { designFilePaths: true },
  });

  if (!replaceSingle && current.designFilePaths.length >= MAX_DESIGN_SLIDES) {
    throw new Error(`Maksimal ${MAX_DESIGN_SLIDES} file design per baris.`);
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const base = sanitizeBaseName(file.name);
  const stored = `design-${randomUUID()}-${base}`;
  const absDir = path.join(getUploadPublicDir(), "room-content-plan", itemId);
  await mkdir(absDir, { recursive: true });
  const absFile = path.join(absDir, stored);
  await writeFile(absFile, buf);
  const publicPath = `/uploads/room-content-plan/${itemId}/${stored}`;

  let nextPaths: string[];
  if (replaceSingle) {
    for (const p of current.designFilePaths) {
      await unlinkIfSafe(p);
    }
    nextPaths = [publicPath];
  } else {
    nextPaths = [...current.designFilePaths, publicPath];
  }

  await prisma.roomContentPlanItem.update({
    where: { id: itemId },
    data: { designFilePaths: nextPaths },
  });
  revalidateTasksAndRoomHub();
  revalidatePath(`/room/${roomId}/content-planning`);
}

export async function removeContentPlanDesignSlide(
  roomId: string,
  itemId: string,
  publicPath: string,
) {
  await assertItemRoom(roomId, itemId);
  const row = await prisma.roomContentPlanItem.findUniqueOrThrow({
    where: { id: itemId },
    select: { designFilePaths: true },
  });
  if (!row.designFilePaths.includes(publicPath)) {
    throw new Error("File tidak ada dalam daftar slide.");
  }
  await unlinkIfSafe(publicPath);
  await prisma.roomContentPlanItem.update({
    where: { id: itemId },
    data: { designFilePaths: row.designFilePaths.filter((p) => p !== publicPath) },
  });
  revalidateTasksAndRoomHub();
  revalidatePath(`/room/${roomId}/content-planning`);
}

export async function clearContentPlanCopywritingFile(roomId: string, itemId: string) {
  await assertItemRoom(roomId, itemId);
  const prev = await prisma.roomContentPlanItem.findUniqueOrThrow({
    where: { id: itemId },
    select: { copywritingFilePath: true },
  });
  await unlinkIfSafe(prev.copywritingFilePath);
  await prisma.roomContentPlanItem.update({
    where: { id: itemId },
    data: { copywritingFilePath: null },
  });
  revalidateTasksAndRoomHub();
  revalidatePath(`/room/${roomId}/content-planning`);
}

export async function clearContentPlanDesignFiles(roomId: string, itemId: string) {
  await assertItemRoom(roomId, itemId);
  const prev = await prisma.roomContentPlanItem.findUniqueOrThrow({
    where: { id: itemId },
    select: { designFilePaths: true },
  });
  for (const p of prev.designFilePaths) {
    await unlinkIfSafe(p);
  }
  await prisma.roomContentPlanItem.update({
    where: { id: itemId },
    data: { designFilePaths: [] },
  });
  revalidateTasksAndRoomHub();
  revalidatePath(`/room/${roomId}/content-planning`);
}

/**
 * Tugas Kanban dari Content Planning: saat tugas **Selesai**, salin lampiran file dari
 * tugas ke `designFilePaths` baris CP (urutan = urutan unggah di tugas) dan set
 * `statusDesign` ke Dipublikasikan. File design lama di folder CP
 * (`/uploads/room-content-plan/...`) dihapus dari disk; path `/uploads/tasks/...`
 * disimpan apa adanya agar carousel/reels tetap bisa dibuka dari CP.
 */
export async function syncContentPlanRowFromCompletedKanbanTask(params: {
  roomId: string;
  itemId: string;
  taskId: string;
  jenisKonten: ContentPlanJenis;
}) {
  const attachments = await prisma.taskAttachment.findMany({
    where: { taskId: params.taskId, publicPath: { not: null } },
    orderBy: { createdAt: "asc" },
    select: { publicPath: true, mimeType: true },
  });
  const fileRows = attachments.filter((a) =>
    Boolean(a.publicPath?.startsWith("/uploads/tasks/")),
  );

  let nextPaths: string[] = [];
  switch (params.jenisKonten) {
    case ContentPlanJenis.CAROUSEL: {
      const imgs = fileRows.filter((a) => a.mimeType.startsWith("image/"));
      nextPaths = imgs.map((a) => a.publicPath!).slice(0, MAX_DESIGN_SLIDES);
      break;
    }
    case ContentPlanJenis.REELS: {
      const v =
        fileRows.find((a) => a.mimeType.startsWith("video/")) ??
        fileRows.find((a) => a.mimeType.startsWith("image/"));
      nextPaths = v?.publicPath ? [v.publicPath] : [];
      break;
    }
    case ContentPlanJenis.SINGLE_FEED: {
      const f = fileRows.find(
        (a) => a.mimeType.startsWith("image/") || a.mimeType.startsWith("video/"),
      );
      nextPaths = f?.publicPath ? [f.publicPath] : [];
      break;
    }
    default:
      nextPaths = [];
  }

  const row = await prisma.roomContentPlanItem.findUnique({
    where: { id: params.itemId },
    select: { roomId: true, designFilePaths: true },
  });
  if (!row || row.roomId !== params.roomId) return;

  for (const p of row.designFilePaths) {
    await unlinkIfSafe(p);
  }

  await prisma.roomContentPlanItem.update({
    where: { id: params.itemId },
    data: {
      designFilePaths: nextPaths,
      statusDesign: ContentPlanStatusKerja.DIPUBLIKASIKAN,
    },
  });
  revalidateTasksAndRoomHub();
  revalidatePath(`/room/${params.roomId}/content-planning`);
}
