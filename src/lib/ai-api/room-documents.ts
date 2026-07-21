import { prisma } from "@/lib/prisma";
import {
  isLikelyTextMime,
  readRoomDocumentText,
} from "@/lib/room-document-text";
import type { AiApiRole } from "./auth";
import { canViewRoomsWiki } from "./auth";
import { listAgentRooms } from "@/lib/agent/queries";
import { createAiApiAgentUser } from "./service-user";
import { matchAgentRoom } from "@/lib/agent/room-match";

function denied(message: string) {
  return { accessible: false as const, message, data: null };
}

function accessDenied(message: string) {
  return denied(message);
}

async function resolveRoomIdForSearch(
  role: AiApiRole,
  roomNameOrId?: string,
) {
  const user = createAiApiAgentUser(role);
  if (!canViewRoomsWiki(role)) {
    return { ok: false as const, error: "Akses ruangan tidak tersedia." };
  }

  if (!roomNameOrId?.trim()) return { ok: true as const, roomId: undefined };

  const rooms = await listAgentRooms(user);
  const match = matchAgentRoom(roomNameOrId, rooms);
  if (match.kind === "exact" || match.kind === "fuzzy") {
    return {
      ok: true as const,
      roomId: match.room.id,
      roomName: match.room.name,
    };
  }
  if (match.kind === "suggest") {
    return {
      ok: false as const,
      error: `Ruangan "${roomNameOrId}" tidak ditemukan. Mungkin maksud: ${match.suggestions
        .slice(0, 3)
        .map((s) => s.room.name)
        .join(", ")}.`,
    };
  }
  return { ok: false as const, error: `Ruangan "${roomNameOrId}" tidak ditemukan.` };
}

const DOCUMENT_SELECT = {
  id: true,
  title: true,
  fileName: true,
  mimeType: true,
  size: true,
  tags: true,
  publicPath: true,
  createdAt: true,
  room: { select: { id: true, name: true } },
  folder: { select: { id: true, name: true } },
  uploadedBy: { select: { name: true, email: true } },
} as const;

function mapDocumentRow(
  d: {
    id: string;
    title: string | null;
    fileName: string;
    mimeType: string;
    size: number;
    tags: string[];
    createdAt: Date;
    room: { id: string; name: string };
    folder: { id: string; name: string } | null;
    uploadedBy: { name: string | null; email: string | null };
  },
  extra?: { textExtractable?: boolean },
) {
  return {
    id: d.id,
    title: d.title || d.fileName,
    fileName: d.fileName,
    mimeType: d.mimeType,
    sizeBytes: d.size,
    tags: d.tags,
    folderId: d.folder?.id ?? null,
    folderName: d.folder?.name ?? null,
    roomId: d.room.id,
    roomName: d.room.name,
    uploadedBy: d.uploadedBy.name?.trim() || d.uploadedBy.email || "—",
    createdAt: d.createdAt.toISOString(),
    textExtractable:
      extra?.textExtractable ??
      isLikelyTextMime(d.mimeType, d.fileName),
  };
}

export async function aiListRoomDocuments(
  role: AiApiRole,
  params?: { roomNameOrId?: string; limit?: number },
) {
  if (!canViewRoomsWiki(role)) {
    return accessDenied("Akses dokumen ruangan tidak tersedia untuk peran ini.");
  }

  const room = await resolveRoomIdForSearch(role, params?.roomNameOrId);
  if (!room.ok) {
    return { accessible: false as const, message: room.error, data: null };
  }

  const limit = Math.min(Math.max(params?.limit ?? 30, 1), 60);
  const docs = await prisma.roomDocument.findMany({
    where: {
      ...(room.roomId ? { roomId: room.roomId } : {}),
      trashedAt: null,
      OR: [{ folderId: null }, { folder: { trashedAt: null } }],
    },
    select: DOCUMENT_SELECT,
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return {
    accessible: true as const,
    roomName: room.roomName ?? null,
    count: docs.length,
    hint: "Panggil get_room_document dengan documentId untuk membaca isi file (PDF, DOCX, TXT, CSV, JSON, HTML).",
    documents: docs.map((d) => mapDocumentRow(d)),
  };
}

export async function aiSearchDocuments(
  role: AiApiRole,
  params: { q: string; roomNameOrId?: string; limit?: number },
) {
  if (!canViewRoomsWiki(role)) {
    return accessDenied("Akses dokumen ruangan tidak tersedia untuk peran ini.");
  }

  const q = params.q.trim();
  if (!q) {
    return accessDenied(
      "Parameter q wajib diisi, atau gunakan list_room_documents untuk daftar terbaru.",
    );
  }

  const room = await resolveRoomIdForSearch(role, params.roomNameOrId);
  if (!room.ok) {
    return { accessible: false as const, message: room.error, data: null };
  }

  const limit = Math.min(params.limit ?? 20, 40);
  const docs = await prisma.roomDocument.findMany({
    where: {
      ...(room.roomId ? { roomId: room.roomId } : {}),
      trashedAt: null,
      AND: [
        { OR: [{ folderId: null }, { folder: { trashedAt: null } }] },
        { OR: [
          { title: { contains: q, mode: "insensitive" } },
          { fileName: { contains: q, mode: "insensitive" } },
          { searchText: { contains: q, mode: "insensitive" } },
          { tags: { has: q.toLowerCase() } },
        ] },
      ],
    },
    select: DOCUMENT_SELECT,
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return {
    accessible: true as const,
    query: q,
    roomName: room.roomName ?? null,
    count: docs.length,
    hint: "Panggil get_room_document dengan documentId untuk membaca isi file.",
    documents: docs.map((d) => mapDocumentRow(d)),
  };
}

export async function aiGetRoomDocumentContent(
  role: AiApiRole,
  documentId: string,
) {
  if (!canViewRoomsWiki(role)) {
    return accessDenied("Akses dokumen ruangan tidak tersedia untuk peran ini.");
  }

  const doc = await prisma.roomDocument.findFirst({
    where: { id: documentId, trashedAt: null, OR: [{ folderId: null }, { folder: { trashedAt: null } }] },
    select: DOCUMENT_SELECT,
  });

  if (!doc) {
    return denied("Dokumen tidak ditemukan.");
  }

  const extraction = await readRoomDocumentText({
    publicPath: doc.publicPath,
    mimeType: doc.mimeType,
    fileName: doc.fileName,
  });

  return {
    accessible: true as const,
    document: {
      ...mapDocumentRow(doc, {
        textExtractable: isLikelyTextMime(doc.mimeType, doc.fileName),
      }),
    },
    content: {
      text: extraction.text,
      extractionMethod: extraction.method,
      truncated: extraction.truncated,
      note: extraction.note ?? null,
    },
  };
}
