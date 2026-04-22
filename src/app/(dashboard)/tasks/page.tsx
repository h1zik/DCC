import Link from "next/link";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ensureTasksAndRoomHubAccess } from "@/lib/ensure-studio-team";
import { isStudioOrProjectManager } from "@/lib/roles";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  ROOM_WORKSPACE_SECTION_ORDER,
  roomWorkspaceSectionBlurb,
  roomWorkspaceSectionTitle,
} from "@/lib/room-workspace-section";
import { RoomMemberAvatarStack } from "@/components/room-member-avatar-stack";
import { DoorOpen, LayoutGrid } from "lucide-react";

export default async function TasksRoomSelectPage() {
  const session = await ensureTasksAndRoomHubAccess();
  const showAllRooms =
    session.user.role === UserRole.CEO ||
    session.user.role === UserRole.ADMINISTRATOR;

  const rooms = await prisma.room.findMany({
    where: showAllRooms
      ? {}
      : { members: { some: { userId: session.user.id } } },
    include: {
      brand: true,
      members: {
        include: {
          user: {
            select: { id: true, name: true, email: true, image: true },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  const sorted = [...rooms].sort((a, b) => {
    const oa = ROOM_WORKSPACE_SECTION_ORDER.indexOf(a.workspaceSection);
    const ob = ROOM_WORKSPACE_SECTION_ORDER.indexOf(b.workspaceSection);
    if (oa !== ob) return oa - ob;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Pilih ruangan kerja
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {showAllRooms
            ? session.user.role === UserRole.CEO
              ? "Ruangan dikelompokkan ke HQ, Team, atau Ruangan. CEO menetapkan administrator di menu Hak akses; administrator mengatur ruangan di menu Ruang kerja."
              : "Ruangan dikelompokkan ke HQ, Team, atau Ruangan. Atur bagian tiap ruangan di menu Ruang kerja saat membuat atau mengedit ruangan."
            : "Hanya ruangan tempat Anda ditetapkan administrator (sebagai manager atau kontributor) yang muncul di sini. Administrator mengatur nama ruangan, bagian (HQ / Team / Ruangan), dan peran di menu Ruang kerja."}
        </p>
      </div>

      {!showAllRooms && sorted.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Belum ada akses ruangan</CardTitle>
            <CardDescription>
              Hubungi administrator agar menambahkan Anda ke ruangan kerja dengan peran
              manager atau kontributor.
            </CardDescription>
          </CardHeader>
          <CardContent />
        </Card>
      ) : (
        <div className="flex flex-col gap-10">
          {ROOM_WORKSPACE_SECTION_ORDER.map((section) => {
            const list = sorted.filter((r) => r.workspaceSection === section);
            if (!showAllRooms && list.length === 0) return null;
            return (
              <section key={section} className="space-y-4">
                <div>
                  <h2 className="text-lg font-semibold tracking-tight">
                    {roomWorkspaceSectionTitle(section)}
                  </h2>
                  <p className="text-muted-foreground text-sm">
                    {roomWorkspaceSectionBlurb(section)}
                  </p>
                </div>
                {list.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    Belum ada ruangan di bagian ini.
                  </p>
                ) : (
                  <ul className="grid gap-4 sm:grid-cols-2">
                    {list.map((r) => (
                      <li key={r.id}>
                        <Link href={`/room/${r.id}/tasks`}>
                          <Card className="hover:border-accent h-full transition-colors">
                            <CardHeader>
                              <div className="flex items-start justify-between gap-2">
                                <DoorOpen className="text-muted-foreground size-5 shrink-0" />
                                <LayoutGrid className="text-muted-foreground size-4" />
                              </div>
                              <CardTitle className="text-lg">{r.name}</CardTitle>
                              <CardDescription>
                                {r.brand
                                  ? `Brand: ${r.brand.name}`
                                  : "Tanpa brand terikat"}
                              </CardDescription>
                              <div className="mt-3">
                                <p className="text-muted-foreground mb-1.5 text-[10px] font-semibold tracking-wide uppercase">
                                  Terlibat
                                </p>
                                <RoomMemberAvatarStack
                                  users={r.members.map((m) => m.user)}
                                />
                              </div>
                            </CardHeader>
                            <CardContent>
                              <span className="text-accent-foreground text-sm font-medium">
                                Buka Kanban →
                              </span>
                            </CardContent>
                          </Card>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}

      {session.user.role === UserRole.CEO ||
      isStudioOrProjectManager(session.user.role) ? (
        <div className="flex flex-wrap gap-3">
          <Link
            href="/projects"
            className={cn(buttonVariants({ variant: "ghost" }))}
          >
            Lihat pipeline
          </Link>
        </div>
      ) : null}
    </div>
  );
}
