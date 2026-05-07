import { UserRole } from "@prisma/client";
import { UserPlus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getRoomMemberContextOrThrow } from "@/lib/ensure-room-studio";
import { isSimpleTeamOrHqRoom } from "@/lib/room-simple-hub";
import { isAdministrator, isProjectManager } from "@/lib/roles";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RoomMembersAdminPanel } from "./room-members-admin-panel";
import { RoomMembersList } from "./room-members-list";

type PageProps = { params: Promise<{ roomId: string }> };

export default async function RoomMembersPage({ params }: PageProps) {
  const { roomId } = await params;
  const [{ room }, session] = await Promise.all([
    getRoomMemberContextOrThrow(roomId),
    auth(),
  ]);
  const canManageMembers =
    session?.user?.role === UserRole.CEO ||
    isProjectManager(session?.user?.role) ||
    isAdministrator(session?.user?.role);
  const simpleRoom = isSimpleTeamOrHqRoom(room);

  const [members, studioUsers] = await Promise.all([
    prisma.roomMember.findMany({
      where: { roomId },
      include: {
        user: {
          select: { id: true, name: true, email: true, image: true, role: true },
        },
      },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    }),
    canManageMembers
      ? prisma.user.findMany({
          where: {
            role: { notIn: [UserRole.LOGISTICS, UserRole.FINANCE, UserRole.CEO] },
          },
          orderBy: { email: "asc" },
          select: { id: true, name: true, email: true, role: true },
        })
      : Promise.resolve([]),
  ]);

  const membersForAdmin = members.map((m) => ({
    id: m.id,
    roomId: m.roomId,
    userId: m.userId,
    role: m.role,
    allowedRoomProcesses: m.allowedRoomProcesses,
    user: {
      id: m.user.id,
      name: m.user.name,
      email: m.user.email,
      role: m.user.role,
    },
  }));

  const membersForList = members.map((m) => ({
    id: m.id,
    roomId: m.roomId,
    userId: m.userId,
    role: m.role,
    allowedRoomProcesses: m.allowedRoomProcesses,
    user: {
      id: m.user.id,
      name: m.user.name,
      email: m.user.email,
      image: m.user.image,
    },
  }));

  return (
    <div className="flex flex-col gap-4">
      {canManageMembers ? (
        <div className="flex justify-end">
          <Dialog>
            <DialogTrigger
              render={
                <Button type="button" variant="outline" size="sm">
                  <UserPlus className="size-3.5" aria-hidden />
                  Kelola Anggota & Peran
                </Button>
              }
            />
            <DialogContent className="max-h-[90vh] w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] overflow-x-hidden overflow-y-auto sm:max-w-3xl">
              <DialogHeader>
                <DialogTitle>Kelola Anggota & Peran</DialogTitle>
              </DialogHeader>
              <RoomMembersAdminPanel
                roomId={roomId}
                members={membersForAdmin}
                studioUsers={studioUsers}
                simpleRoom={simpleRoom}
              />
            </DialogContent>
          </Dialog>
        </div>
      ) : null}
      <RoomMembersList members={membersForList} />
    </div>
  );
}
