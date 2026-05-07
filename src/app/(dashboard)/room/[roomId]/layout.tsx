import { RoomHubNav } from "./room-hub-nav";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getRoomHubMemberUsers,
  getRoomMemberContextOrThrow,
} from "@/lib/ensure-room-studio";
import { isSimpleTeamOrHqRoom } from "@/lib/room-simple-hub";
import { isRoomHubManagerRole } from "@/lib/room-access";
import { isAdministrator } from "@/lib/roles";
import { UserRole } from "@prisma/client";

type LayoutProps = {
  children: React.ReactNode;
  params: Promise<{ roomId: string }>;
};

export default async function RoomHubLayout({ children, params }: LayoutProps) {
  const { roomId } = await params;
  const [{ room, role }, session] = await Promise.all([
    getRoomMemberContextOrThrow(roomId),
    auth(),
  ]);
  const simpleHub = isSimpleTeamOrHqRoom(room);
  const bannerImage = (room as { bannerImage?: string | null }).bannerImage ?? null;
  const canEditRoom =
    session?.user?.role === UserRole.CEO || isAdministrator(session?.user?.role);
  const [memberUsers, brands] = await Promise.all([
    getRoomHubMemberUsers(roomId),
    canEditRoom ? prisma.brand.findMany({ orderBy: { name: "asc" } }) : Promise.resolve([]),
  ]);

  return (
    <div className="mx-auto flex min-w-0 w-full max-w-[1400px] flex-col gap-6 px-1 pb-8 sm:px-0">
      <RoomHubNav
        roomId={roomId}
        roomName={room.name}
        simpleHub={simpleHub}
        bannerImage={bannerImage}
        canEditBanner={isRoomHubManagerRole(role)}
        canEditRoom={canEditRoom}
        roomBrandId={room.brandId}
        roomWorkspaceSection={room.workspaceSection}
        brands={brands}
        brand={room.brand ? { id: room.brand.id, name: room.brand.name } : null}
        memberUsers={memberUsers}
      />
      {children}
    </div>
  );
}
