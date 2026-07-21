import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  collectDocumentZipEntries,
  collectFolderZipEntries,
  sanitizeZipArchiveBasename,
} from "@/lib/room-document-download";
import { buildDocumentDownloadResponse } from "@/lib/room-document-zip-api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ token: string }> };

export async function GET(_request: Request, { params }: Ctx) {
  const { token } = await params;
  const active = { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] };
  const documentShare = await prisma.roomDocumentShare.findFirst({
    where: {
      token,
      ...active,
      document: {
        trashedAt: null,
        OR: [{ folderId: null }, { folder: { trashedAt: null } }],
      },
    },
    select: {
      document: {
        select: { id: true, folderId: true, fileName: true, publicPath: true },
      },
    },
  });
  if (documentShare) {
    return buildDocumentDownloadResponse(
      collectDocumentZipEntries([documentShare.document]),
      sanitizeZipArchiveBasename(documentShare.document.fileName, "document"),
    );
  }

  const folderShare = await prisma.roomDocumentFolderShare.findFirst({
    where: { token, ...active, folder: { trashedAt: null } },
    select: { folder: { select: { id: true, roomId: true, name: true } } },
  });
  if (!folderShare) return new NextResponse("Tautan tidak valid atau kedaluwarsa.", { status: 404 });
  const [folders, documents] = await Promise.all([
    prisma.roomDocumentFolder.findMany({
      where: { roomId: folderShare.folder.roomId, trashedAt: null },
      select: { id: true, name: true, parentId: true, sortOrder: true },
    }),
    prisma.roomDocument.findMany({
      where: { roomId: folderShare.folder.roomId, trashedAt: null },
      select: { id: true, folderId: true, fileName: true, publicPath: true },
    }),
  ]);
  const entries = collectFolderZipEntries(folderShare.folder.id, folders, documents);
  if (entries.length === 0) return new NextResponse("Folder kosong.", { status: 404 });
  return buildDocumentDownloadResponse(
    entries,
    sanitizeZipArchiveBasename(folderShare.folder.name, "folder"),
  );
}
