import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getRoomMemberContextOrThrow } from "@/lib/ensure-room-studio";
import { isRoomHubManagerRole } from "@/lib/room-access";
import { auth } from "@/lib/auth";
import { RoomDocumentsUpload } from "./room-documents-upload";
import { RoomDocumentsList } from "./room-documents-list";

type PageProps = { params: Promise<{ roomId: string }> };

export default async function RoomDocumentsPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const uid = session.user.id;
  const { roomId } = await params;
  const { role } = await getRoomMemberContextOrThrow(roomId);
  const isRoomManager = isRoomHubManagerRole(role);

  const documents = await prisma.roomDocument.findMany({
    where: { roomId },
    orderBy: { createdAt: "desc" },
    include: {
      uploadedBy: { select: { id: true, name: true, email: true } },
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-sm">
        Arsip file bersama untuk ruangan ini (kontrak, PDF, gambar referensi,
        dll.), terpisah dari lampiran pada tugas individu.
      </p>
      <RoomDocumentsUpload roomId={roomId} />
      <RoomDocumentsList
        documents={documents}
        currentUserId={uid}
        isRoomManager={isRoomManager}
      />
    </div>
  );
}
