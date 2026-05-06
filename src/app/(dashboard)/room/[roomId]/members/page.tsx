import Image from "next/image";
import Link from "next/link";
import { RoomMemberRole, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getRoomMemberContextOrThrow } from "@/lib/ensure-room-studio";
import {
  ROOM_PROJECT_MANAGER_ROLE,
  roomMemberToProcessAccess,
} from "@/lib/room-member-process-access";
import { roomTaskProcessLabel } from "@/lib/room-task-process";
import { isSimpleTeamOrHqRoom } from "@/lib/room-simple-hub";
import { isAdministrator, isProjectManager } from "@/lib/roles";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RoomMembersAdminPanel } from "./room-members-admin-panel";

type PageProps = { params: Promise<{ roomId: string }> };

function roomRoleLabel(role: RoomMemberRole): string {
  if (role === ROOM_PROJECT_MANAGER_ROLE) return "Project manager ruangan";
  switch (role) {
    case RoomMemberRole.ROOM_MANAGER:
      return "Manager ruangan";
    case RoomMemberRole.ROOM_CONTRIBUTOR:
      return "Kontributor";
    default:
      return role;
  }
}

function userInitial(name: string | null, email: string): string {
  return (name?.trim() || email).slice(0, 1).toUpperCase() || "?";
}

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

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-sm">
        Daftar anggota aktif di ruangan ini beserta peran dan akses fase tugasnya.
        {canManageMembers
          ? " Pengaturan anggota/peran ada langsung di halaman ini."
          : ""}
      </p>
      {canManageMembers ? (
        <Dialog>
          <DialogTrigger
            render={<Button type="button" variant="outline" size="sm" />}
          >
            Kelola Anggota & Peran
          </DialogTrigger>
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
      ) : null}
      {members.length === 0 ? (
        <div className="text-muted-foreground rounded-xl border border-dashed p-4 text-sm">
          Belum ada anggota di ruangan ini.
        </div>
      ) : (
        <ul className="grid gap-3">
          {members.map((member) => {
            const access = roomMemberToProcessAccess(member);
            const fullAccess = access.role === ROOM_PROJECT_MANAGER_ROLE;
            const displayName = member.user.name ?? member.user.email;
            return (
              <li
                key={member.id}
                className="bg-card rounded-xl border border-border p-3"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex items-center gap-3">
                    {member.user.image ? (
                      <Image
                        src={member.user.image}
                        alt={displayName}
                        width={44}
                        height={44}
                        className="border-border size-11 rounded-full border object-cover"
                        unoptimized
                      />
                    ) : (
                      <div
                        className="border-border bg-muted text-muted-foreground flex size-11 shrink-0 items-center justify-center rounded-full border text-sm font-semibold"
                        aria-hidden
                      >
                        {userInitial(member.user.name, member.user.email)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <Link
                        href={`/profile/${member.user.id}`}
                        className="truncate text-sm font-semibold underline-offset-4 hover:underline focus-visible:underline"
                      >
                        {displayName}
                      </Link>
                      <p className="text-muted-foreground truncate text-xs">
                        {member.user.email}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline">{roomRoleLabel(access.role)}</Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {fullAccess ? (
                    <Badge variant="secondary">Semua fase proses</Badge>
                  ) : access.allowedRoomProcesses.length === 0 ? (
                    <Badge variant="outline">Belum ada fase aktif</Badge>
                  ) : (
                    access.allowedRoomProcesses.map((proc) => (
                      <Badge key={proc} variant="secondary">
                        {roomTaskProcessLabel(proc)}
                      </Badge>
                    ))
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
