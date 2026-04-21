import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getRoomMemberContextOrThrow } from "@/lib/ensure-room-studio";
import { isRoomHubManagerRole } from "@/lib/room-access";
import { auth } from "@/lib/auth";
import { RoomDocumentsWorkspace } from "./room-documents-workspace";

type PageProps = { params: Promise<{ roomId: string }> };

export default async function RoomDocumentsPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const uid = session.user.id;
  const { roomId } = await params;
  const { role } = await getRoomMemberContextOrThrow(roomId);
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
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-sm">
        Arsip file bersama untuk ruangan ini (kontrak, PDF, logo, referensi,
        dll.), terpisah dari lampiran pada tugas individu. Buat folder untuk
        mengelompokkan (misalnya Logo, Legal); unggahan baru memakai pilihan
        &quot;Simpan ke folder&quot;, dan file yang sudah ada dapat dipindahkan
        lewat dropdown Folder di setiap baris. Manager ruangan dapat mengganti
        nama atau menghapus folder — jika folder dihapus, file di dalamnya
        otomatis pindah ke Tanpa folder.
      </p>
      <RoomDocumentsWorkspace
        roomId={roomId}
        folders={folders}
        documents={documents}
        currentUserId={uid}
        isRoomManager={isRoomManager}
      />
    </div>
  );
}
