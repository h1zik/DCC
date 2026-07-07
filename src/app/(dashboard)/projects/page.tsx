import { UserRole } from "@prisma/client";
import { GitBranch, Info } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { ensurePipelineAccess } from "@/lib/ensure-pipeline-access";
import {
  canEditProjectMilestones,
  canManagePipelineProjects,
} from "@/lib/roles";
import { computeMilestoneProgress } from "@/lib/project-milestones";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { PageHero, PageHeroChip } from "@/components/page-hero";
import { seedDefaultProjectMilestones } from "@/lib/project-milestones";
import { ProjectsPipeline } from "./projects-client";

export default async function ProjectsPage() {
  const session = await ensurePipelineAccess();

  const projects = await prisma.project.findMany({
    where: { brandId: { not: null } },
    include: {
      brand: true,
      room: { include: { brand: true } },
      milestones: {
        orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }],
        select: {
          id: true,
          parentId: true,
          title: true,
          description: true,
          status: true,
          sortOrder: true,
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  const withoutMilestones = projects.filter((p) => p.milestones.length === 0);
  if (withoutMilestones.length > 0) {
    await Promise.all(
      withoutMilestones.map((p) => seedDefaultProjectMilestones(prisma, p.id)),
    );
    for (const p of withoutMilestones) {
      p.milestones = await prisma.projectMilestone.findMany({
        where: { projectId: p.id },
        orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }],
        select: {
          id: true,
          parentId: true,
          title: true,
          description: true,
          status: true,
          sortOrder: true,
        },
      });
    }
  }

  const canManageProjects = canManagePipelineProjects(session.user.role);
  const canEditMilestones = canEditProjectMilestones(session.user.role);
  const isCeo = session.user.role === UserRole.CEO;

  const progressList = projects.map((p) => computeMilestoneProgress(p.milestones));
  const avgProgress =
    progressList.length > 0
      ? Math.round(
          progressList.reduce((a, b) => a + b, 0) / progressList.length,
        )
      : 0;
  const completedCount = progressList.filter((p) => p >= 100).length;

  const [brands, rooms] = canManageProjects
    ? await Promise.all([
        prisma.brand.findMany({ orderBy: { name: "asc" } }),
        prisma.room.findMany({
          include: { brand: true },
          orderBy: { name: "asc" },
        }),
      ])
    : [[], []];

  return (
    <div className="flex w-full flex-col gap-6">
      <PageHero
        icon={GitBranch}
        variant="compact"
        title="Pipeline proyek"
        subtitle="Linimasa milestone per proyek — pantau progress pengembangan produk dari validasi pasar hingga produksi."
        right={
          <>
            <PageHeroChip>
              <span className="text-foreground font-semibold tabular-nums">
                {projects.length}
              </span>
              proyek
            </PageHeroChip>
            <PageHeroChip>
              <span className="text-foreground font-semibold tabular-nums">
                {avgProgress}%
              </span>
              rata-rata milestone
            </PageHeroChip>
            <PageHeroChip>
              <span className="bg-emerald-500 size-1.5 rounded-full" aria-hidden />
              <span className="text-foreground font-semibold tabular-nums">
                {completedCount}
              </span>
              selesai 100%
            </PageHeroChip>
            <Popover>
              <PopoverTrigger
                render={
                  <Button type="button" variant="outline" size="sm">
                    <Info className="size-3.5" aria-hidden />
                    Cara kerja
                  </Button>
                }
              />
              <PopoverContent className="text-muted-foreground w-72 space-y-2 text-xs leading-relaxed">
                <p className="text-foreground font-semibold">Milestone proyek</p>
                <ul className="ml-4 list-disc space-y-1">
                  <li>
                    Setiap proyek punya 11 tahap utama default; tiap tahap bisa
                    punya sub-milestone.
                  </li>
                  <li>
                    Progress = milestone <span className="text-foreground font-medium">utama</span>{" "}
                    berstatus{" "}
                    <span className="text-foreground font-medium">Selesai</span>{" "}
                    ÷ 11 tahap utama.
                  </li>
                  <li>
                    Tim studio / PM mengelola milestone; CEO & admin memantau
                    persentase di halaman ini.
                  </li>
                  <li>Klik kartu proyek untuk detail linimasa.</li>
                </ul>
              </PopoverContent>
            </Popover>
          </>
        }
      />
      <ProjectsPipeline
        projects={projects}
        brands={brands}
        rooms={rooms}
        canManageProjects={canManageProjects}
        canEditMilestones={canEditMilestones}
        isCeo={isCeo}
      />
    </div>
  );
}
