import path from "node:path";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireTasksRoomHubSession } from "@/lib/auth-helpers";
import {
  collectDocumentZipEntries,
  collectFolderZipEntries,
  sanitizeZipArchiveBasename,
  type RoomDocumentZipEntry,
} from "@/lib/room-document-download";
import { assertRoomMember } from "@/lib/room-access";
import { buildDocumentDownloadResponse } from "@/lib/room-document-zip-api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z
  .object({
    documentIds: z.array(z.string().min(1)).max(200).optional().default([]),
    folderIds: z.array(z.string().min(1)).max(200).optional().default([]),
  })
  .refine((v) => v.documentIds.length + v.folderIds.length > 0, {
    message: "Tidak ada item yang dipilih.",
  });

/**
 * Jaga agar tak ada dua entri dengan path zip identik — object zip fflate
 * memakai key path, jadi duplikat akan saling menimpa (mis. dua folder
 * terpilih bernama sama).
 */
function ensureUniqueZipName(
  zipName: string,
  used: Map<string, number>,
): string {
  const n = used.get(zipName) ?? 0;
  used.set(zipName, n + 1);
  if (n === 0) return zipName;
  const ext = path.extname(zipName);
  const stem = ext ? zipName.slice(0, -ext.length) : zipName;
  return `${stem} (${n + 1})${ext}`;
}

type Ctx = { params: Promise<{ roomId: string }> };

export async function POST(req: Request, { params }: Ctx) {
  try {
    const session = await requireTasksRoomHubSession();
    const { roomId } = await params;
    await assertRoomMember(roomId, session.user.id);

    const json: unknown = await req.json();
    const { documentIds, folderIds } = bodySchema.parse(json);

    const entries: RoomDocumentZipEntry[] = [];
    const seenDocIds = new Set<string>();
    const usedZipNames = new Map<string, number>();

    const pushEntries = (list: RoomDocumentZipEntry[]) => {
      for (const entry of list) {
        if (seenDocIds.has(entry.documentId)) continue;
        seenDocIds.add(entry.documentId);
        entries.push({
          ...entry,
          zipName: ensureUniqueZipName(entry.zipName, usedZipNames),
        });
      }
    };

    // File lepas (dipilih langsung) → di root arsip.
    let looseDocuments: {
      id: string;
      folderId: string | null;
      fileName: string;
      publicPath: string;
    }[] = [];
    if (documentIds.length > 0) {
      looseDocuments = await prisma.roomDocument.findMany({
        where: {
          roomId,
          id: { in: documentIds },
          trashedAt: null,
          OR: [{ folderId: null }, { folder: { trashedAt: null } }],
        },
        select: { id: true, folderId: true, fileName: true, publicPath: true },
      });
      pushEntries(collectDocumentZipEntries(looseDocuments));
    }

    // Folder (dipilih langsung) → isi tiap folder di bawah nama foldernya.
    let selectedFolders: { id: string; name: string }[] = [];
    if (folderIds.length > 0) {
      const [allFolders, allDocuments] = await Promise.all([
        prisma.roomDocumentFolder.findMany({
          where: { roomId, trashedAt: null },
          select: { id: true, name: true, parentId: true, sortOrder: true },
        }),
        prisma.roomDocument.findMany({
          where: {
            roomId,
            trashedAt: null,
            OR: [{ folderId: null }, { folder: { trashedAt: null } }],
          },
          select: { id: true, folderId: true, fileName: true, publicPath: true },
        }),
      ]);
      selectedFolders = allFolders.filter((f) => folderIds.includes(f.id));
      for (const folder of selectedFolders) {
        pushEntries(collectFolderZipEntries(folder.id, allFolders, allDocuments));
      }
    }

    if (entries.length === 0) {
      return new NextResponse("Tidak ada file yang dapat diunduh.", {
        status: 404,
      });
    }

    const totalItems = documentIds.length + folderIds.length;
    let basename: string;
    if (folderIds.length === 0 && looseDocuments.length === 1) {
      basename = sanitizeZipArchiveBasename(
        looseDocuments[0]!.fileName,
        "document",
      );
    } else if (documentIds.length === 0 && selectedFolders.length === 1) {
      basename = sanitizeZipArchiveBasename(
        selectedFolders[0]!.name,
        selectedFolders[0]!.id.slice(0, 8),
      );
    } else {
      basename = `download-${totalItems}`;
    }

    return await buildDocumentDownloadResponse(entries, basename);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return new NextResponse("Permintaan tidak valid.", { status: 400 });
    }
    const message = e instanceof Error ? e.message : "Gagal mengunduh.";
    const status =
      message.includes("Unauthorized") || message.includes("autentikasi")
        ? 401
        : message.includes("anggota")
          ? 403
          : 500;
    return new NextResponse(message, { status });
  }
}
