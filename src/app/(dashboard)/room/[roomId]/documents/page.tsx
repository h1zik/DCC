import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { getRoomMemberContextOrThrow } from "@/lib/ensure-room-studio";
import { isRoomHubManagerRole } from "@/lib/room-access";
import { RoomDocumentsWorkspace } from "./room-documents-workspace";
import { queryRoomDocumentLibrary } from "@/lib/room-document-library";
import { getDescendantFolderIds } from "@/lib/room-document-folders";

type PageProps = { params: Promise<{ roomId: string }> };

export default async function RoomDocumentsPage({ params }: PageProps) {
  const { roomId } = await params;
  const { role, viewerUserId: uid } = await getRoomMemberContextOrThrow(roomId);
  const isRoomManager = isRoomHubManagerRole(role);

  const [
    folders,
    trashFolders,
    initialLibrary,
    members,
    documentAggregate,
    rootFileCount,
  ] = await Promise.all([
    prisma.roomDocumentFolder.findMany({
      where: { roomId, trashedAt: null },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        _count: { select: { documents: { where: { trashedAt: null } } } },
        favorites: { where: { userId: uid }, select: { userId: true } },
        shares: {
          where: {
            recipientId: uid,
            role: "EDITOR",
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
          },
          select: { id: true },
        },
      },
    }),
    prisma.roomDocumentFolder.findMany({
      where: {
        roomId,
        trashedAt: { not: null },
        OR: [{ parentId: null }, { parent: { trashedAt: null } }],
      },
      orderBy: { trashedAt: "desc" },
      include: {
        _count: { select: { documents: true } },
        favorites: { where: { userId: uid }, select: { userId: true } },
      },
    }),
    queryRoomDocumentLibrary({ roomId, userId: uid, folderId: null }),
    prisma.roomMember.findMany({
      where: { roomId },
      select: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { user: { name: "asc" } },
    }),
    prisma.roomDocument.aggregate({
      where: { roomId, trashedAt: null, OR: [{ folderId: null }, { folder: { trashedAt: null } }] },
      _count: { id: true },
      _sum: { size: true },
    }),
    prisma.roomDocument.count({
      where: { roomId, folderId: null, trashedAt: null },
    }),
  ]);

  const folderNodes = folders;
  const folderById = new Map(folderNodes.map((folder) => [folder.id, folder]));
  const directEditableFolderIds = new Set(
    folders.filter((folder) => folder.shares.length > 0).map((folder) => folder.id),
  );
  const folderRows = folders.map(({ favorites, shares, ...folder }) => {
    const descendants = getDescendantFolderIds(folderNodes, folder.id);
    const recursiveDocuments = folder._count.documents + folderNodes
      .filter((candidate) => descendants.has(candidate.id))
      .reduce((sum, candidate) => sum + candidate._count.documents, 0);
    let canEdit = directEditableFolderIds.has(folder.id);
    let parentId = folder.parentId;
    while (!canEdit && parentId) {
      canEdit = directEditableFolderIds.has(parentId);
      parentId = folderById.get(parentId)?.parentId ?? null;
    }
    void shares;
    return {
      ...folder,
      isFavorite: favorites.length > 0,
      canEdit,
      _count: { ...folder._count, recursiveDocuments },
    };
  });

  return (
    <Suspense
      fallback={
        <div className="text-muted-foreground py-12 text-center text-sm">
          Memuat dokumen…
        </div>
      }
    >
      <RoomDocumentsWorkspace
        roomId={roomId}
        folders={folderRows}
        trashFolders={trashFolders.map(({ favorites, ...folder }) => ({
          ...folder,
          isFavorite: favorites.length > 0,
        }))}
        documents={initialLibrary.documents.map((d) => ({
          ...d,
          tags: d.tags ?? [],
        }))}
        initialDocumentTotal={initialLibrary.total}
        storageSummary={{
          fileCount: documentAggregate._count.id,
          rootFileCount,
          totalSize: documentAggregate._sum.size ?? 0,
        }}
        documentMembers={members.map((member) => member.user)}
        currentUserId={uid}
        isRoomManager={isRoomManager}
      />
    </Suspense>
  );
}
