import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTasksRoomHubSession } from "@/lib/auth-helpers";
import { assertRoomMember } from "@/lib/room-access";
import { collectDocumentZipEntries, sanitizeZipArchiveBasename } from "@/lib/room-document-download";
import { buildDocumentDownloadResponse } from "@/lib/room-document-zip-api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = {
  params: Promise<{ roomId: string; documentId: string; versionId: string }>;
};

export async function GET(_request: Request, { params }: Ctx) {
  const session = await requireTasksRoomHubSession();
  const { roomId, documentId, versionId } = await params;
  await assertRoomMember(roomId, session.user.id);
  const version = await prisma.roomDocumentVersion.findFirst({
    where: { id: versionId, documentId, document: { roomId } },
    select: { id: true, fileName: true, publicPath: true, document: { select: { folderId: true } } },
  });
  if (!version) return new NextResponse("Versi tidak ditemukan.", { status: 404 });
  return buildDocumentDownloadResponse(
    collectDocumentZipEntries([
      { id: version.id, folderId: version.document.folderId, fileName: version.fileName, publicPath: version.publicPath },
    ]),
    sanitizeZipArchiveBasename(version.fileName, "version"),
  );
}
