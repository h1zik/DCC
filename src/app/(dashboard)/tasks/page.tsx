import Link from "next/link";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ensureTasksAndRoomHubAccess } from "@/lib/ensure-studio-team";
import { isStudioOrProjectManager } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { RoomsPicker, type RoomsPickerRoom } from "./rooms-picker";

export default async function TasksRoomSelectPage() {
  const session = await ensureTasksAndRoomHubAccess();
  const showAllRooms =
    session.user.role === UserRole.CEO ||
    session.user.role === UserRole.ADMINISTRATOR;
  const canManageRooms =
    session.user.role === UserRole.ADMINISTRATOR ||
    session.user.role === UserRole.CEO;

  const [rooms, brands] = await Promise.all([
    prisma.room.findMany({
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
    }),
    canManageRooms
      ? prisma.brand.findMany({ orderBy: { name: "asc" } })
      : Promise.resolve([]),
  ]);

  const pickerRooms: RoomsPickerRoom[] = rooms.map((r) => ({
    id: r.id,
    name: r.name,
    workspaceSection: r.workspaceSection,
    logoImage: r.logoImage ?? null,
    brand: r.brand
      ? {
          id: r.brand.id,
          name: r.brand.name,
          colorCode: r.brand.colorCode ?? null,
        }
      : null,
    members: r.members.map((m) => m.user),
  }));

  const showPipelineLink =
    session.user.role === UserRole.CEO ||
    isStudioOrProjectManager(session.user.role);

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 pb-10">
      <RoomsPicker
        rooms={pickerRooms}
        brands={brands}
        canManageRooms={canManageRooms}
        showAllRooms={showAllRooms}
        isCeo={session.user.role === UserRole.CEO}
      />

      {showPipelineLink ? (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            nativeButton={false}
            render={<Link href="/projects" />}
          >
            Lihat pipeline
            <ArrowRight className="size-3.5" aria-hidden />
          </Button>
        </div>
      ) : null}
    </div>
  );
}
