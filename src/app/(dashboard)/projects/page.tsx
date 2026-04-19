import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ensurePipelineAccess } from "@/lib/ensure-pipeline-access";
import { syncOverdueTasks } from "@/lib/sync-task-overdue";
import { canManagePipelineProjects } from "@/lib/roles";
import { ProjectsPipeline } from "./projects-client";

export default async function ProjectsPage() {
  const session = await ensurePipelineAccess();
  await syncOverdueTasks();

  const projects = await prisma.project.findMany({
    where: { brandId: { not: null } },
    include: {
      brand: true,
      room: { include: { brand: true } },
      tasks: { select: { id: true, status: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  const canEdit = canManagePipelineProjects(session.user.role);
  const isCeo = session.user.role === UserRole.CEO;
  const [brands, rooms] = canEdit
    ? await Promise.all([
        prisma.brand.findMany({ orderBy: { name: "asc" } }),
        prisma.room.findMany({
          include: { brand: true },
          orderBy: { name: "asc" },
        }),
      ])
    : [[], []];

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Pipeline pengembangan produk
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Tahapan IDE → R&D → Desain → Sampling → Produksi → Peluncuran. Tim
          studio / PM mengajukan pindah tahap; CEO menyetujui di menu
          Persetujuan CEO (CEO juga dapat menerapkan pindah tahap langsung dari
          sini). Proyek tetap di kolom tahap resmi sampai disetujui.
        </p>
      </div>
      <ProjectsPipeline
        projects={projects}
        brands={brands}
        rooms={rooms}
        canEdit={canEdit}
        isCeo={isCeo}
      />
    </div>
  );
}
