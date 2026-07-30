import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import sharp from "sharp";
import { auth } from "@/lib/auth";
import { getUploadPublicDir } from "@/lib/upload-storage";
import { resolveWhiteboardAccess } from "@/lib/whiteboard/board-access";

/**
 * Unggah gambar ke papan (tempel dari clipboard, drag & drop, atau tombol
 * "Gambar" di toolbar).
 *
 * Gambar dinormalisasi lewat `sharp`: dikecilkan bila melebihi batas dan
 * dikonversi ke WebP. Selain menghemat tempat, proses re-encode ini juga
 * membuang payload berbahaya yang mungkin diselipkan di file gambar.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ roomId: string; boardId: string }> };

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const MAX_DIMENSION = 4096;

const ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/avif",
  "image/svg+xml",
]);

export async function POST(req: Request, { params }: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Belum masuk." }, { status: 401 });
  }
  const { roomId, boardId } = await params;

  const access = await resolveWhiteboardAccess(boardId, session.user.id);
  if (!access.ok) {
    return NextResponse.json({ error: access.message }, { status: access.status });
  }
  if (access.context.roomId !== roomId) {
    return NextResponse.json({ error: "Papan tidak ditemukan." }, { status: 404 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Unggahan tidak valid." }, { status: 400 });
  }

  const file = form.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Pilih gambar terlebih dahulu." }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: "Ukuran gambar maksimal 25 MB." },
      { status: 413 },
    );
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json(
      { error: "Format gambar tidak didukung." },
      { status: 415 },
    );
  }

  const input = Buffer.from(await file.arrayBuffer());

  let output: Buffer;
  let width: number;
  let height: number;
  try {
    // `animated: true` menjaga GIF tetap bergerak setelah dikonversi ke WebP.
    const pipelineInput = sharp(input, { animated: file.type === "image/gif" });
    const meta = await pipelineInput.metadata();
    const sourceWidth = meta.width ?? 0;
    const sourceHeight = meta.pageHeight ?? meta.height ?? 0;
    if (!sourceWidth || !sourceHeight) {
      return NextResponse.json({ error: "Gambar tidak terbaca." }, { status: 400 });
    }

    const scale = Math.min(
      1,
      MAX_DIMENSION / sourceWidth,
      MAX_DIMENSION / sourceHeight,
    );
    width = Math.max(1, Math.round(sourceWidth * scale));
    height = Math.max(1, Math.round(sourceHeight * scale));

    output = await pipelineInput
      .rotate()
      .resize({ width, height, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    return NextResponse.json(
      { error: "Gambar gagal diproses." },
      { status: 400 },
    );
  }

  const fileName = `${randomUUID()}.webp`;
  const absDir = path.join(getUploadPublicDir(), "rooms", roomId, "whiteboards", boardId);
  try {
    await mkdir(absDir, { recursive: true });
    await writeFile(path.join(absDir, fileName), output);
  } catch {
    return NextResponse.json(
      { error: "Gambar gagal disimpan." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    src: `/uploads/rooms/${roomId}/whiteboards/${boardId}/${fileName}`,
    width,
    height,
  });
}
