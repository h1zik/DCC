import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  personalFileExists,
  resolvePersonalFilePath,
} from "@/lib/personal-file-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ fileId: string }> };

/**
 * Unduh file Space Pribadi. Guard = kepemilikan murni (`ownerId`) — TANPA
 * bypass peran. SENGAJA mengembalikan 404 (bukan 403) untuk non-pemilik,
 * beda dari route dokumen ruangan: non-pemilik tidak boleh tahu file itu ada.
 */
export async function GET(_req: Request, { params }: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return new NextResponse("Belum masuk.", { status: 401 });
  }
  const { fileId } = await params;

  const file = await prisma.personalFile.findFirst({
    where: { id: fileId, ownerId: session.user.id },
    select: {
      id: true,
      fileName: true,
      mimeType: true,
      size: true,
      storagePath: true,
    },
  });
  if (!file) {
    return new NextResponse("File tidak ditemukan.", { status: 404 });
  }

  const exists = await personalFileExists(file.storagePath);
  if (!exists) {
    return new NextResponse("File fisik hilang.", { status: 410 });
  }

  const fullPath = resolvePersonalFilePath(file.storagePath);
  const nodeStream = createReadStream(fullPath);
  const stream = Readable.toWeb(nodeStream) as unknown as ReadableStream;

  return new NextResponse(stream, {
    status: 200,
    headers: {
      "Content-Type": file.mimeType || "application/octet-stream",
      "Content-Length": String(file.size),
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
