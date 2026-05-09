import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getRoomMemberContextOrThrow } from "@/lib/ensure-room-studio";
import { isRoomHubManagerRole } from "@/lib/room-access";
import { RoomDocumentsWorkspace } from "./room-documents-workspace";

type PageProps = { params: Promise<{ roomId: string }> };

export default async function RoomDocumentsPage({ params }: PageProps) {
  const { roomId } = await params;
  const { role, viewerUserId: uid } = await getRoomMemberContextOrThrow(roomId);
  const isRoomManager = isRoomHubManagerRole(role);

  const [folders, documents] = await Promise.all([
    prisma.roomDocumentFolder.findMany({
      where: { roomId },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { _count: { select: { documents: true } } },
    }),
    prisma.roomDocument.findMany({
      where: { roomId },
      orderBy: { createdAt: "desc" },
      include: {
        uploadedBy: { select: { id: true, name: true, email: true } },
      },
    }),
  ]);

  return (
    <RoomDocumentsWorkspace
      roomId={roomId}
      folders={folders}
      documents={documents.map((d) => ({
        ...d,
        tags: d.tags ?? [],
      }))}
      currentUserId={uid}
      isRoomManager={isRoomManager}
    />
  );
}
