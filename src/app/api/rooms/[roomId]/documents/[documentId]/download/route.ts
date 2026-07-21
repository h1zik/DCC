import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTasksRoomHubSession } from "@/lib/auth-helpers";
import { assertRoomMember } from "@/lib/room-access";
import {
  collectDocumentZipEntries,
  sanitizeZipArchiveBasename,
} from "@/lib/room-document-download";
import { buildDocumentDownloadResponse } from "@/lib/room-document-zip-api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ roomId: string; documentId: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await requireTasksRoomHubSession();
    const { roomId, documentId } = await params;
    await assertRoomMember(roomId, session.user.id);

    const doc = await prisma.roomDocument.findFirst({
      where: { id: documentId, roomId, trashedAt: null, OR: [{ folderId: null }, { folder: { trashedAt: null } }] },
      select: { id: true, folderId: true, fileName: true, publicPath: true },
    });
    if (!doc) {
      return new NextResponse("Dokumen tidak ditemukan.", { status: 404 });
    }

    const entries = collectDocumentZipEntries([doc]);
    if (entries.length === 0) {
      return new NextResponse("Tidak ada file yang dapat diunduh.", { status: 404 });
    }

    const basename = sanitizeZipArchiveBasename(doc.fileName, "document");
    return await buildDocumentDownloadResponse(entries, basename);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Gagal mengunduh.";
    const status = message.includes("Unauthorized") || message.includes("autentikasi")
      ? 401
      : message.includes("anggota")
        ? 403
        : 500;
    return new NextResponse(message, { status });
  }
}
