import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getDescendantFolderIds } from "@/lib/room-document-folders";

export const ROOM_DOCUMENT_LIBRARY_PAGE_SIZE = 40;

export type RoomDocumentLibraryScope = "browse" | "favorites" | "recent" | "trash";
export type RoomDocumentLibrarySort =
  | "newest"
  | "oldest"
  | "name"
  | "name_desc"
  | "size"
  | "size_asc"
  | "type"
  | "uploader";

export type RoomDocumentLibraryQuery = {
  roomId: string;
  userId: string;
  folderId?: string | null;
  search?: string;
  tag?: string;
  type?: "all" | "image" | "video" | "audio" | "pdf" | "document" | "archive";
  uploaderId?: string;
  date?: "all" | "today" | "week" | "month";
  scope?: RoomDocumentLibraryScope;
  sort?: RoomDocumentLibrarySort;
  offset?: number;
};

function mimeWhere(type: NonNullable<RoomDocumentLibraryQuery["type"]>) {
  if (type === "image" || type === "video" || type === "audio") {
    return { mimeType: { startsWith: `${type}/` } };
  }
  if (type === "pdf") return { mimeType: "application/pdf" };
  if (type === "archive") {
    return {
      OR: ["zip", "compressed", "rar", "tar", "gzip"].map((part) => ({
        mimeType: { contains: part, mode: "insensitive" as const },
      })),
    };
  }
  if (type === "document") {
    return {
      OR: [
        { mimeType: { startsWith: "text/" } },
        { mimeType: { contains: "document", mode: "insensitive" as const } },
        { mimeType: { contains: "word", mode: "insensitive" as const } },
        { mimeType: { contains: "spreadsheet", mode: "insensitive" as const } },
      ],
    };
  }
  return {};
}

function dateStart(date: NonNullable<RoomDocumentLibraryQuery["date"]>) {
  if (date === "all") return null;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  if (date === "week") start.setDate(start.getDate() - 6);
  if (date === "month") start.setDate(start.getDate() - 29);
  return start;
}

function orderBy(sort: RoomDocumentLibrarySort): Prisma.RoomDocumentOrderByWithRelationInput[] {
  switch (sort) {
    case "oldest": return [{ createdAt: "asc" }];
    case "name": return [{ title: "asc" }, { fileName: "asc" }];
    case "name_desc": return [{ title: "desc" }, { fileName: "desc" }];
    case "size": return [{ size: "desc" }];
    case "size_asc": return [{ size: "asc" }];
    case "type": return [{ mimeType: "asc" }, { fileName: "asc" }];
    case "uploader": return [{ uploadedBy: { name: "asc" } }, { createdAt: "desc" }];
    default: return [{ createdAt: "desc" }];
  }
}

export async function queryRoomDocumentLibrary(input: RoomDocumentLibraryQuery) {
  const scope = input.scope ?? "browse";
  const q = input.search?.trim();
  const and: Prisma.RoomDocumentWhereInput[] = [];
  if (scope === "trash") {
    and.push({ trashedAt: { not: null } });
  } else {
    and.push({ trashedAt: null });
    and.push({ OR: [{ folderId: null }, { folder: { trashedAt: null } }] });
  }
  if (scope === "browse" && !q) and.push({ folderId: input.folderId ?? null });
  if (scope === "favorites") and.push({ favorites: { some: { userId: input.userId } } });
  if (scope === "recent") {
    const recent = new Date();
    recent.setDate(recent.getDate() - 30);
    and.push({ updatedAt: { gte: recent } });
  }
  if (q) {
    and.push({
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { fileName: { contains: q, mode: "insensitive" } },
        { searchText: { contains: q, mode: "insensitive" } },
        { tags: { has: q.toLowerCase() } },
      ],
    });
  }
  if (input.tag && input.tag !== "__all__") and.push({ tags: { has: input.tag } });
  if (input.type && input.type !== "all") and.push(mimeWhere(input.type));
  if (input.uploaderId) and.push({ uploadedById: input.uploaderId });
  const createdAfter = dateStart(input.date ?? "all");
  if (createdAfter) and.push({ createdAt: { gte: createdAfter } });

  const where: Prisma.RoomDocumentWhereInput = { roomId: input.roomId, AND: and };
  const offset = Math.max(input.offset ?? 0, 0);
  const now = new Date();
  const [folderNodes, editorFolderShares] = await Promise.all([
    prisma.roomDocumentFolder.findMany({
      where: { roomId: input.roomId },
      select: { id: true, name: true, parentId: true, sortOrder: true },
    }),
    prisma.roomDocumentFolderShare.findMany({
      where: {
        roomId: input.roomId,
        recipientId: input.userId,
        role: "EDITOR",
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      select: { folderId: true },
    }),
  ]);
  const editableFolderIds = new Set<string>();
  for (const share of editorFolderShares) {
    editableFolderIds.add(share.folderId);
    for (const id of getDescendantFolderIds(folderNodes, share.folderId)) {
      editableFolderIds.add(id);
    }
  }
  const [rows, total] = await Promise.all([
    prisma.roomDocument.findMany({
      where,
      orderBy: orderBy(input.sort ?? "newest"),
      skip: offset,
      take: ROOM_DOCUMENT_LIBRARY_PAGE_SIZE,
      include: {
        uploadedBy: { select: { id: true, name: true, email: true } },
        favorites: { where: { userId: input.userId }, select: { userId: true } },
        shares: {
          where: {
            recipientId: input.userId,
            role: "EDITOR",
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
          },
          select: { id: true },
        },
      },
    }),
    prisma.roomDocument.count({ where }),
  ]);

  const folderWhere: Prisma.RoomDocumentFolderWhereInput =
    scope === "trash"
      ? { roomId: input.roomId, trashedAt: { not: null } }
      : {
          roomId: input.roomId,
          trashedAt: null,
          ...(scope === "favorites"
            ? { favorites: { some: { userId: input.userId } } }
            : q
              ? { name: { contains: q, mode: "insensitive" } }
              : { id: { in: [] } }),
        };
  const matchedFolders =
    scope === "recent" || (scope === "browse" && !q)
      ? []
      : await prisma.roomDocumentFolder.findMany({
          where: folderWhere,
          orderBy: [{ name: "asc" }],
          select: { id: true },
          take: 200,
        });

  return {
    documents: rows.map(({ favorites, shares, ...row }) => ({
      ...row,
      isFavorite: favorites.length > 0,
      canEdit:
        row.uploadedById === input.userId ||
        shares.length > 0 ||
        (row.folderId != null && editableFolderIds.has(row.folderId)),
    })),
    total,
    nextOffset:
      offset + rows.length < total ? offset + rows.length : null,
    matchedFolderIds: matchedFolders.map((folder) => folder.id),
  };
}
