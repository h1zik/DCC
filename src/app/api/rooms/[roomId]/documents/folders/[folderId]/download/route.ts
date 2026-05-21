import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTasksRoomHubSession } from "@/lib/auth-helpers";
import { assertRoomMember } from "@/lib/room-access";
import {
  collectFolderZipEntries,
  sanitizeZipArchiveBasename,
} from "@/lib/room-document-download";
import { buildDocumentDownloadResponse } from "@/lib/room-document-zip-api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ roomId: string; folderId: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await requireTasksRoomHubSession();
    const { roomId, folderId } = await params;
    await assertRoomMember(roomId, session.user.id);

    const folder = await prisma.roomDocumentFolder.findFirst({
      where: { id: folderId, roomId },
      select: { id: true, name: true },
    });
    if (!folder) {
      return new NextResponse("Folder tidak ditemukan.", { status: 404 });
    }

    const [folders, documents] = await Promise.all([
      prisma.roomDocumentFolder.findMany({
        where: { roomId },
        select: { id: true, name: true, parentId: true, sortOrder: true },
      }),
      prisma.roomDocument.findMany({
        where: { roomId },
        select: { id: true, folderId: true, fileName: true, publicPath: true },
      }),
    ]);

    const entries = collectFolderZipEntries(folderId, folders, documents);
    if (entries.length === 0) {
      return new NextResponse("Folder tidak berisi file yang dapat diunduh.", {
        status: 404,
      });
    }

    const basename = sanitizeZipArchiveBasename(folder.name, folder.id.slice(0, 8));
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
