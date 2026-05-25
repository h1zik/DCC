"use server";

import { revalidatePath } from "next/cache";
import { RoomTimelineStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireProjectEditor } from "@/lib/auth-helpers";
import {
  replaceProjectMilestonesWithDefaults,
  seedDefaultProjectMilestones,
} from "@/lib/project-milestones";
import { revalidateTasksAndRoomHub } from "@/lib/revalidate-workspace";

async function assertBrandedProject(projectId: string) {
  const project = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    select: { brandId: true },
  });
  if (!project.brandId) {
    throw new Error("Milestone hanya untuk proyek pengembangan produk (ber-brand).");
  }
  return project;
}

function revalidateProjectPaths() {
  revalidatePath("/projects");
  revalidatePath("/");
  revalidateTasksAndRoomHub();
}

/** Pastikan proyek punya milestone default bila masih kosong. */
export async function ensureProjectMilestones(projectId: string) {
  await assertBrandedProject(projectId);
  await seedDefaultProjectMilestones(prisma, projectId);
  revalidateProjectPaths();
}

const upsertSchema = z.object({
  id: z.string().optional(),
  projectId: z.string().min(1),
  parentId: z.string().nullable().optional(),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional().nullable(),
  status: z.nativeEnum(RoomTimelineStatus).default(RoomTimelineStatus.UPCOMING),
});

export async function upsertProjectMilestone(input: z.infer<typeof upsertSchema>) {
  await requireProjectEditor();
  const data = upsertSchema.parse(input);
  await assertBrandedProject(data.projectId);

  const parentId = data.parentId ?? null;

  if (parentId) {
    const parent = await prisma.projectMilestone.findUniqueOrThrow({
      where: { id: parentId },
      select: { projectId: true, parentId: true },
    });
    if (parent.projectId !== data.projectId) {
      throw new Error("Milestone induk tidak termasuk proyek ini.");
    }
    if (parent.parentId) {
      throw new Error("Sub-milestone hanya boleh di bawah milestone utama.");
    }
  }

  if (data.id) {
    const row = await prisma.projectMilestone.findUniqueOrThrow({
      where: { id: data.id },
      select: { projectId: true, parentId: true },
    });
    if (row.projectId !== data.projectId) {
      throw new Error("Milestone tidak termasuk proyek ini.");
    }
    if (parentId && parentId !== row.parentId) {
      throw new Error("Tidak dapat memindahkan milestone ke induk lain.");
    }
    await prisma.projectMilestone.update({
      where: { id: data.id },
      data: {
        title: data.title,
        description: data.description?.trim() || null,
        status: data.status,
      },
    });
  } else {
    const max = await prisma.projectMilestone.aggregate({
      where: { projectId: data.projectId, parentId },
      _max: { sortOrder: true },
    });
    await prisma.projectMilestone.create({
      data: {
        projectId: data.projectId,
        parentId,
        title: data.title,
        description: data.description?.trim() || null,
        status: data.status,
        sortOrder: (max._max.sortOrder ?? -1) + 1,
      },
    });
  }

  revalidateProjectPaths();
}

export async function updateProjectMilestoneStatus(
  milestoneId: string,
  status: RoomTimelineStatus,
) {
  await requireProjectEditor();
  const m = await prisma.projectMilestone.findUniqueOrThrow({
    where: { id: milestoneId },
    select: { projectId: true },
  });
  await assertBrandedProject(m.projectId);
  await prisma.projectMilestone.update({
    where: { id: milestoneId },
    data: { status },
  });
  revalidateProjectPaths();
}

export async function deleteProjectMilestone(milestoneId: string) {
  await requireProjectEditor();
  const m = await prisma.projectMilestone.findUniqueOrThrow({
    where: { id: milestoneId },
    select: { projectId: true },
  });
  await assertBrandedProject(m.projectId);
  await prisma.projectMilestone.delete({ where: { id: milestoneId } });
  revalidateProjectPaths();
}

/** Reset seluruh linimasa proyek ke template 11 tahap (hapus kustom & sub). */
export async function resetAllProjectMilestonesToDefault(projectId: string) {
  await requireProjectEditor();
  await assertBrandedProject(projectId);
  await replaceProjectMilestonesWithDefaults(prisma, projectId);
  revalidateProjectPaths();
}
