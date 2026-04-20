import Image from "next/image";
import { RoomMemberRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getRoomMemberContextOrThrow } from "@/lib/ensure-room-studio";
import {
  ROOM_PROJECT_MANAGER_ROLE,
  roomMemberToProcessAccess,
} from "@/lib/room-member-process-access";
import { roomTaskProcessLabel } from "@/lib/room-task-process";
import { Badge } from "@/components/ui/badge";

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
  await getRoomMemberContextOrThrow(roomId);

  const members = await prisma.roomMember.findMany({
    where: { roomId },
    include: {
      user: {
        select: { id: true, name: true, email: true, image: true, role: true },
      },
    },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
  });

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-sm">
        Daftar anggota aktif di ruangan ini beserta peran dan akses fase tugasnya.
      </p>
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
                      <p className="truncate text-sm font-semibold">{displayName}</p>
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
