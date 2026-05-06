import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ensureAdministratorRoomsAccess } from "@/lib/ensure-administrator-rooms";
import { ROOM_WORKSPACE_SECTION_ORDER } from "@/lib/room-workspace-section";
import { RoomsClient } from "./rooms-client";

export default async function RoomsPage() {
  await ensureAdministratorRoomsAccess();

  const [roomsRaw, brands, studioUsers] = await Promise.all([
    prisma.room.findMany({
      include: {
        brand: true,
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, role: true },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.brand.findMany({ orderBy: { name: "asc" } }),
    prisma.user.findMany({
      where: {
          role: { notIn: [UserRole.LOGISTICS, UserRole.FINANCE, UserRole.CEO] },
        },
      orderBy: { email: "asc" },
      select: { id: true, name: true, email: true, role: true },
    }),
  ]);

  const rooms = [...roomsRaw].sort((a, b) => {
    const oa = ROOM_WORKSPACE_SECTION_ORDER.indexOf(a.workspaceSection);
    const ob = ROOM_WORKSPACE_SECTION_ORDER.indexOf(b.workspaceSection);
    if (oa !== ob) return oa - ob;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Ruang kerja</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Administrator membuat ruangan, menetapkan peran (manager, kontributor,
          atau project manager ruangan), serta fase proses tugas yang dapat
          diakses masing-masing anggota. Pilih bagian HQ, Team, atau Ruangan agar
          pengelompokan di menu Tugas & Kanban sesuai. Project manager ruangan
          melihat semua fase; manager dan kontributor hanya fase yang Anda
          centang. Tim membuka ruangan dari menu Tugas. CEO menetapkan siapa
          yang memiliki peran administrator di menu Pengguna.
        </p>
      </div>
      <RoomsClient rooms={rooms} brands={brands} studioUsers={studioUsers} />
    </div>
  );
}
