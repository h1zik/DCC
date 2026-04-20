import { RoomHubNav } from "./room-hub-nav";
import { getRoomMemberContextOrThrow } from "@/lib/ensure-room-studio";
import { isSimpleTeamOrHqRoom } from "@/lib/room-simple-hub";
import { isRoomHubManagerRole } from "@/lib/room-access";
import { prisma } from "@/lib/prisma";

type LayoutProps = {
  children: React.ReactNode;
  params: Promise<{ roomId: string }>;
};

export default async function RoomHubLayout({ children, params }: LayoutProps) {
  const { roomId } = await params;
  const { room, role } = await getRoomMemberContextOrThrow(roomId);
  const simpleHub = isSimpleTeamOrHqRoom(room);
  const bannerImage = (room as { bannerImage?: string | null }).bannerImage ?? null;
  const members = await prisma.roomMember.findMany({
    where: { roomId },
    include: {
      user: {
        select: { id: true, name: true, email: true, image: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });
  const memberUsers = members.map((m) => m.user);

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 px-1 pb-8 sm:px-0">
      <RoomHubNav
        roomId={roomId}
        roomName={room.name}
        simpleHub={simpleHub}
        bannerImage={bannerImage}
        canEditBanner={isRoomHubManagerRole(role)}
        memberUsers={memberUsers}
      />
      {children}
    </div>
  );
}
