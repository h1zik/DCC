"use server";

import { revalidatePath } from "next/cache";
import {
  NotificationType,
  PipelineStage,
  UserRole,
} from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { requireProjectEditor } from "@/lib/auth-helpers";
import { PIPELINE_LABELS } from "@/lib/pipeline";
import { recomputeProjectProgress } from "@/lib/project-progress";
import { notifyCeo } from "@/lib/notify";
import { isSimpleHubRoom } from "@/lib/room-simple-hub";
import { revalidateTasksAndRoomHub } from "@/lib/revalidate-workspace";

/** Setelah `prisma generate` — cast aman sebelum client terbaru. */
const NOTIFY_PIPELINE_STAGE =
  "PROJECT_PIPELINE_APPROVAL_REQUESTED" as NotificationType;

const createSchema = z.object({
  roomId: z.string().min(1),
  brandId: z.string().min(1),
  name: z.string().min(1),
});

export async function createProject(input: z.infer<typeof createSchema>) {
  await requireProjectEditor();
  const data = createSchema.parse(input);
  await prisma.project.create({
    data: {
      roomId: data.roomId,
      brandId: data.brandId,
      name: data.name,
      currentStage: PipelineStage.MARKET_RESEARCH,
      stageEnteredAt: new Date(),
    },
  });
  revalidatePath("/projects");
  revalidateTasksAndRoomHub();
  revalidatePath("/rooms");
  revalidatePath("/");
}

const metaSchema = z.object({
  projectId: z.string().min(1),
  name: z.string().min(1),
});

export async function updateProjectMeta(input: z.infer<typeof metaSchema>) {
  await requireProjectEditor();
  const data = metaSchema.parse(input);
  await prisma.project.update({
    where: { id: data.projectId },
    data: { name: data.name },
  });
  revalidatePath("/projects");
  revalidateTasksAndRoomHub();
  revalidatePath("/rooms");
  revalidatePath("/");
}

const stageSchema = z.object({
  projectId: z.string().min(1),
  stage: z.nativeEnum(PipelineStage),
});

async function assertNoBlockingTaskApprovals(projectId: string) {
  const blocking = await prisma.task.findFirst({
    where: {
      projectId,
      isApprovalRequired: true,
      isApproved: false,
    },
  });
  if (blocking) {
    throw new Error(
      "Masih ada tugas yang menunggu persetujuan CEO sebelum proyek pindah tahap.",
    );
  }
}

async function applyApprovedPipelineStage(
  projectId: string,
  stage: PipelineStage,
) {
  await assertNoBlockingTaskApprovals(projectId);
  await prisma.project.update({
    where: { id: projectId },
    data: {
      currentStage: stage,
      stageEnteredAt: new Date(),
      pendingPipelineStage: null,
      pipelineStageRequestedAt: null,
    } as never,
  });
}

function revalidatePipelineAndApprovals() {
  revalidatePath("/projects");
  revalidateTasksAndRoomHub();
  revalidatePath("/rooms");
  revalidatePath("/");
  revalidatePath("/approvals");
}

/**
 * Pengajuan pindah tahap pipeline.
 * - Tim studio / PM: mengisi `pendingPipelineStage` + notifikasi CEO (tahap resmi belum berubah).
 * - CEO: menerapkan langsung ke `currentStage` (otoritas akhir).
 */
export async function requestProjectPipelineStage(
  input: z.infer<typeof stageSchema>,
) {
  await requireProjectEditor();
  const session = await auth();
  if (!session?.user?.id) throw new Error("Belum masuk.");

  const { projectId, stage } = stageSchema.parse(input);

  const project = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    include: { brand: true, room: { select: { id: true } } },
  });

  if (!project.brandId) {
    throw new Error(
      "Proyek papan tugas internal tidak memakai pipeline tahapan produk.",
    );
  }

  const projectTyped = project as typeof project & {
    brand: { name: string };
  };

  if (session.user.role === UserRole.CEO) {
    if (stage === projectTyped.currentStage) {
      if (projectTyped.pendingPipelineStage) {
        await prisma.project.update({
          where: { id: projectId },
          data: {
            pendingPipelineStage: null,
            pipelineStageRequestedAt: null,
          } as never,
        });
        revalidatePipelineAndApprovals();
      }
      return;
    }
    await applyApprovedPipelineStage(projectId, stage);
    revalidatePipelineAndApprovals();
    return;
  }

  if (stage === projectTyped.currentStage) {
    await prisma.project.update({
      where: { id: projectId },
      data: {
        pendingPipelineStage: null,
        pipelineStageRequestedAt: null,
      } as never,
    });
    revalidatePipelineAndApprovals();
    return;
  }

  await prisma.project.update({
    where: { id: projectId },
    data: {
      pendingPipelineStage: stage,
      pipelineStageRequestedAt: new Date(),
    } as never,
  });

  await notifyCeo(
    `Persetujuan pipeline: ${projectTyped.name} (${projectTyped.brand.name}) — diajukan pindah ke ${PIPELINE_LABELS[stage]}`,
    NOTIFY_PIPELINE_STAGE,
  );

  revalidatePipelineAndApprovals();
}

export async function cancelProjectPipelineRequest(projectId: string) {
  await requireProjectEditor();
  const p = (await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
  })) as unknown as { pendingPipelineStage: PipelineStage | null };
  if (!p.pendingPipelineStage) return;
  await prisma.project.update({
    where: { id: projectId },
    data: {
      pendingPipelineStage: null,
      pipelineStageRequestedAt: null,
    } as never,
  });
  revalidatePipelineAndApprovals();
}

export async function approveProjectPipelineStage(projectId: string) {
  const session = await auth();
  if (!session?.user || session.user.role !== UserRole.CEO) {
    throw new Error("Hanya CEO yang dapat menyetujui.");
  }

  const project = (await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
  })) as unknown as { pendingPipelineStage: PipelineStage | null };
  if (!project.pendingPipelineStage) {
    throw new Error("Tidak ada pengajuan pindah tahap untuk proyek ini.");
  }

  await applyApprovedPipelineStage(projectId, project.pendingPipelineStage);
  revalidatePipelineAndApprovals();
}

export async function rejectProjectPipelineStage(projectId: string) {
  const session = await auth();
  if (!session?.user || session.user.role !== UserRole.CEO) {
    throw new Error("Hanya CEO yang dapat menolak pengajuan.");
  }

  const p = (await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
  })) as unknown as { pendingPipelineStage: PipelineStage | null };
  if (!p.pendingPipelineStage) {
    throw new Error("Tidak ada pengajuan yang tertunda.");
  }

  await prisma.project.update({
    where: { id: projectId },
    data: {
      pendingPipelineStage: null,
      pipelineStageRequestedAt: null,
    } as never,
  });
  revalidatePipelineAndApprovals();
}

export async function deleteProject(projectId: string) {
  await requireProjectEditor();
  const p = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    select: { brandId: true, roomId: true },
  });
  if (!p.brandId && (await isSimpleHubRoom(p.roomId))) {
    throw new Error(
      "Proyek papan tugas bawaan ruangan HQ/Team tidak dapat dihapus. Ubah ruangan ke jenis lain jika ingin struktur berbeda.",
    );
  }
  await prisma.project.delete({ where: { id: projectId } });
  revalidatePath("/projects");
  revalidateTasksAndRoomHub();
  revalidatePath("/rooms");
  revalidatePath("/");
}

/** Sinkronkan progress dari tugas (panggil setelah impor/seed). */
export async function refreshProjectProgress(projectId: string) {
  await requireProjectEditor();
  await recomputeProjectProgress(projectId);
  revalidatePath("/projects");
  revalidateTasksAndRoomHub();
  revalidatePath("/rooms");
}
