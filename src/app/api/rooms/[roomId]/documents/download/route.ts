import { NextResponse } from "next/server";
import { z } from "zod";
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

const bodySchema = z.object({
  documentIds: z.array(z.string().min(1)).min(1).max(200),
});

type Ctx = { params: Promise<{ roomId: string }> };

export async function POST(req: Request, { params }: Ctx) {
  try {
    const session = await requireTasksRoomHubSession();
    const { roomId } = await params;
    await assertRoomMember(roomId, session.user.id);

    const json: unknown = await req.json();
    const { documentIds } = bodySchema.parse(json);

    const documents = await prisma.roomDocument.findMany({
      where: { roomId, id: { in: documentIds }, trashedAt: null, OR: [{ folderId: null }, { folder: { trashedAt: null } }] },
      select: { id: true, folderId: true, fileName: true, publicPath: true },
    });
    if (documents.length === 0) {
      return new NextResponse("Dokumen tidak ditemukan.", { status: 404 });
    }

    const entries = collectDocumentZipEntries(documents);
    if (entries.length === 0) {
      return new NextResponse("Tidak ada file yang dapat diunduh.", { status: 404 });
    }

    const basename =
      documents.length === 1
        ? sanitizeZipArchiveBasename(documents[0]!.fileName, "document")
        : `documents-${documents.length}`;

    return await buildDocumentDownloadResponse(entries, basename);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return new NextResponse("Permintaan tidak valid.", { status: 400 });
    }
    const message = e instanceof Error ? e.message : "Gagal mengunduh.";
    const status = message.includes("Unauthorized") || message.includes("autentikasi")
      ? 401
      : message.includes("anggota")
        ? 403
        : 500;
    return new NextResponse(message, { status });
  }
}
