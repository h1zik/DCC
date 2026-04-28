import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getRoomMemberContextOrThrow } from "@/lib/ensure-room-studio";
import { isSimpleTeamOrHqRoom } from "@/lib/room-simple-hub";
import { ContentPlanningClient } from "./content-planning-client";

type PageProps = { params: Promise<{ roomId: string }> };

export default async function RoomContentPlanningPage({ params }: PageProps) {
  const { roomId } = await params;
  const { room } = await getRoomMemberContextOrThrow(roomId);
  if (isSimpleTeamOrHqRoom(room)) {
    redirect(`/room/${roomId}/tasks`);
  }

  const [items, memberRows] = await Promise.all([
    prisma.roomContentPlanItem.findMany({
      where: { roomId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        pic: { select: { id: true, name: true, email: true, image: true } },
      },
    }),
    prisma.roomMember.findMany({
      where: { roomId },
      include: { user: { select: { id: true, name: true, email: true, image: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const picUserOptions = memberRows.map((m) => m.user);

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <p className="text-muted-foreground text-sm">
        Tabel perencanaan konten per ruangan. PIC dipilih dari anggota ruangan;
        status copywriting & design mengikuti alur kerja tim.
      </p>
      <ContentPlanningClient
        roomId={roomId}
        items={items}
        picUserOptions={picUserOptions}
      />
    </div>
  );
}
