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
  const logoImage = (room as { logoImage?: string | null }).logoImage ?? null;
  const canEditRoom =
    session?.user?.role === UserRole.CEO || isAdministrator(session?.user?.role);
  const isHubManager = isRoomHubManagerRole(role);
  const [memberUsers, brands] = await Promise.all([
    getRoomHubMemberUsers(roomId),
    canEditRoom ? prisma.brand.findMany({ orderBy: { name: "asc" } }) : Promise.resolve([]),
  ]);

  return (
    <div className="flex min-w-0 w-full flex-col gap-6 has-[>[data-chat-shell]]:min-h-0 has-[>[data-chat-shell]]:flex-1 has-[>[data-chat-shell]]:gap-0">
      <RoomHubNav
        roomId={roomId}
        roomName={room.name}
        simpleHub={simpleHub}
        logoImage={logoImage}
        canEditAssets={isHubManager}
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
