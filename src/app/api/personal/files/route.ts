import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  removePersonalFileBestEffort,
  savePersonalFileToDisk,
} from "@/lib/personal-file-storage";
import { isAllowedRoomDocumentMime } from "@/lib/room-document-upload";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from "@/lib/upload-limits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Nama folder otomatis untuk lampiran yang diunggah dari editor Catatan. */
const NOTE_ATTACHMENT_FOLDER = "Lampiran Catatan";

/**
 * Upload file Space Pribadi (multipart). Guard = kepemilikan murni via
 * sesi — TANPA cek peran. File ditulis di luar direktori publik dan hanya
 * bisa diunduh lewat route download ber-auth.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new NextResponse("Belum masuk.", { status: 401 });
  }
  const ownerId = session.user.id;

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return new NextResponse("Body harus multipart/form-data.", { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return new NextResponse("File tidak ditemukan di form.", { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return new NextResponse(`Ukuran file maksimal ${MAX_UPLOAD_LABEL}.`, {
      status: 413,
    });
  }
  const mimeType = file.type || "application/octet-stream";
  if (!isAllowedRoomDocumentMime(mimeType)) {
    return new NextResponse("Tipe file tidak diizinkan.", { status: 415 });
  }

  // Tentukan folder tujuan: folderId eksplisit (harus milik user), atau
  // folder otomatis "Lampiran Catatan" bila upload berasal dari editor.
  const rawFolderId = formData.get("folderId");
  const source = formData.get("source");
  let folderId: string | null = null;
  if (typeof rawFolderId === "string" && rawFolderId) {
    const folder = await prisma.personalFileFolder.findFirst({
      where: { id: rawFolderId, ownerId },
      select: { id: true },
    });
    if (!folder) {
      return new NextResponse("Folder tidak ditemukan.", { status: 404 });
    }
    folderId = folder.id;
  } else if (source === "note") {
    // Compound unique tidak bisa dipakai upsert dengan parentId null —
    // cari dulu, buat bila belum ada (duplikat karena race tidak berbahaya).
    const existing = await prisma.personalFileFolder.findFirst({
      where: { ownerId, parentId: null, name: NOTE_ATTACHMENT_FOLDER },
      select: { id: true },
    });
    folderId =
      existing?.id ??
      (
        await prisma.personalFileFolder.create({
          data: { ownerId, parentId: null, name: NOTE_ATTACHMENT_FOLDER },
          select: { id: true },
        })
      ).id;
  }

  let saved: { storagePath: string; bytesWritten: number };
  try {
    saved = await savePersonalFileToDisk({
      ownerId,
      fileName: file.name || "file",
      size: file.size,
      body: file.stream(),
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Gagal menyimpan file.";
    return new NextResponse(message, { status: 400 });
  }

  try {
    const row = await prisma.personalFile.create({
      data: {
        ownerId,
        folderId,
        fileName: file.name || "file",
        mimeType,
        size: saved.bytesWritten || file.size,
        storagePath: saved.storagePath,
      },
      select: { id: true, fileName: true, mimeType: true, size: true },
    });
    return NextResponse.json(row);
  } catch (err) {
    // DB gagal setelah file tertulis — bersihkan file yatim.
    await removePersonalFileBestEffort(saved.storagePath);
    const message =
      err instanceof Error ? err.message : "Gagal menyimpan metadata file.";
    return new NextResponse(message, { status: 500 });
  }
}
