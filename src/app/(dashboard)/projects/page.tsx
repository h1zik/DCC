import { UserRole } from "@prisma/client";
import { GitBranch, Info } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { ensurePipelineAccess } from "@/lib/ensure-pipeline-access";
import { canManagePipelineProjects } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { PageHero, PageHeroChip } from "@/components/page-hero";
import { ProjectsPipeline } from "./projects-client";

export default async function ProjectsPage() {
  const session = await ensurePipelineAccess();

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

  const stageCounts = projects.reduce<Record<string, number>>((acc, p) => {
    acc[p.currentStage] = (acc[p.currentStage] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6">
      <PageHero
        icon={GitBranch}
        title="Pipeline pengembangan produk"
        subtitle="Tahapan IDE → R&D → Desain → Sampling → Produksi → Peluncuran. Tim studio / PM mengajukan pindah tahap; CEO menyetujui di menu Persetujuan CEO."
        right={
          <>
            <PageHeroChip>
              <span className="text-foreground font-semibold tabular-nums">
                {projects.length}
              </span>
              proyek aktif
            </PageHeroChip>
            <PageHeroChip>
              <span className="bg-amber-500 size-1.5 rounded-full" aria-hidden />
              <span className="text-foreground font-semibold tabular-nums">
                {stageCounts.PRODUCTION ?? 0}
              </span>
              produksi
            </PageHeroChip>
            <PageHeroChip>
              <span className="bg-emerald-500 size-1.5 rounded-full" aria-hidden />
              <span className="text-foreground font-semibold tabular-nums">
                {stageCounts.LAUNCH ?? 0}
              </span>
              launch
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
                <p className="text-foreground font-semibold">Alur pipeline</p>
                <ul className="ml-4 list-disc space-y-1">
                  <li>Tim studio / PM mengajukan pindah tahap.</li>
                  <li>
                    CEO menyetujui di menu{" "}
                    <span className="text-foreground font-medium">
                      Persetujuan CEO
                    </span>
                    . CEO juga dapat menerapkan pindah tahap langsung.
                  </li>
                  <li>
                    Proyek tetap di kolom tahap resmi sampai disetujui.
                  </li>
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
        canEdit={canEdit}
        isCeo={isCeo}
      />
    </div>
  );
}
