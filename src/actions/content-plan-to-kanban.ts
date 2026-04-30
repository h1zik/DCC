"use server";

import { revalidatePath } from "next/cache";
import {
  ContentPlanStatusKerja,
  RoomTaskProcess,
  TaskPriority,
  TaskStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireTasksRoomHubSession } from "@/lib/auth-helpers";
import { assertRoomMember } from "@/lib/room-access";
import { isSimpleHubRoom } from "@/lib/room-simple-hub";
import { createTask } from "@/actions/tasks";

function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function startOfDayUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function buildDesignTaskTitle(konten: string): string {
  const base = konten.trim() || "Konten";
  return `[Design] ${base}`;
}

function buildDesignTaskDescription(row: {
  id: string;
  detailKonten: string | null;
  designLink: string | null;
  jenisKonten: string;
}): string {
  const lines = [
    `Dibuat dari Content Planning (item ${row.id}).`,
    `Jenis: ${row.jenisKonten}`,
    row.detailKonten?.trim() ? `Detail:\n${row.detailKonten.trim()}` : null,
    row.designLink?.trim() ? `Link design: ${row.designLink.trim()}` : null,
  ].filter(Boolean);
  return lines.join("\n\n");
}

/**
 * Buat tugas Kanban (design) dari baris content planning yang:
 * - status design = Baru
 * - deadline design dalam window [hari ini, +7 hari] (inklusif, per hari kalender UTC)
 *
 * Setelah tugas berhasil dibuat, status design baris diubah ke Dalam Proses.
 */
export async function createKanbanTasksFromContentPlanDesign(params: {
  roomId: string;
  projectId: string;
}): Promise<{ created: number; skipped: number }> {
  const session = await requireTasksRoomHubSession();
  await assertRoomMember(params.roomId, session.user.id);

  const project = await prisma.project.findFirst({
    where: { id: params.projectId, roomId: params.roomId },
    select: { id: true },
  });
  if (!project) {
    throw new Error("Proyek tidak ditemukan di ruangan ini.");
  }

  const simpleHub = await isSimpleHubRoom(params.roomId);
  const roomProcess = simpleHub
    ? RoomTaskProcess.MARKET_RESEARCH
    : RoomTaskProcess.BRAND_AND_DESIGN;

  const today = startOfDayUtc(new Date());
  const weekEnd = addDays(today, 7);

  const items = await prisma.roomContentPlanItem.findMany({
    where: {
      roomId: params.roomId,
      statusDesign: ContentPlanStatusKerja.BARU,
      deadlineDesign: { not: null, gte: today, lte: weekEnd },
    },
    select: {
      id: true,
      konten: true,
      jenisKonten: true,
      detailKonten: true,
      designLink: true,
      picUserIds: true,
      picUserId: true,
      deadlineDesign: true,
    },
  });

  let created = 0;
  let skipped = 0;

  for (const row of items) {
    const due = row.deadlineDesign;
    if (!due) {
      skipped += 1;
      continue;
    }

    const title = buildDesignTaskTitle(row.konten);
    const description = buildDesignTaskDescription({
      id: row.id,
      detailKonten: row.detailKonten,
      designLink: row.designLink,
      jenisKonten: row.jenisKonten,
    });

    const picIds = row.picUserIds?.length
      ? row.picUserIds
      : row.picUserId
        ? [row.picUserId]
        : [];

    const existing = await prisma.task.findFirst({
      where: {
        OR: [
          { contentPlanItemId: row.id },
          {
            projectId: params.projectId,
            roomProcess,
            title,
            dueDate: due,
          },
        ],
      },
      select: { id: true },
    });
    if (existing) {
      skipped += 1;
      continue;
    }

    await createTask({
      projectId: params.projectId,
      title,
      description,
      assigneeIds: picIds,
      priority: TaskPriority.MEDIUM,
      status: TaskStatus.TODO,
      dueDate: due,
      isApprovalRequired: false,
      roomProcess,
      contentPlanItemId: row.id,
      contentPlanJenis: row.jenisKonten,
    });
    await prisma.roomContentPlanItem.update({
      where: { id: row.id },
      data: { statusDesign: ContentPlanStatusKerja.DALAM_PROSES },
    });
    created += 1;
  }

  revalidatePath(`/room/${params.roomId}/content-planning`);
  return { created, skipped };
}
