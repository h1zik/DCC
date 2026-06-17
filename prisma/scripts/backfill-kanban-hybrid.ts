/**
 * One-off backfill: CORE columns, Task.kanbanColumnId, TaskKanbanPosition by columnId.
 * Run after `prisma db push` with new schema:
 *   npx tsx prisma/scripts/backfill-kanban-hybrid.ts
 */
import {
  KanbanColumnKind,
  RoomTaskProcess,
  TaskStatus,
} from "@prisma/client";
import { prisma } from "../../src/lib/prisma";
import { DEFAULT_KANBAN_STATUSES, taskStatusLabel } from "../../src/lib/task-status-ui";

const CORE_STATUSES = DEFAULT_KANBAN_STATUSES;

async function main() {
  const baselineTasks = await prisma.task.count();
  console.log(`Baseline tasks: ${baselineTasks}`);

  await prisma.$transaction(async (tx) => {
    // Mark CORE: satu kolom per linkedStatus utama per fase (bukan semua yang bucket-nya sama).
    for (const coreRole of CORE_STATUSES) {
      const groups = await tx.roomKanbanColumn.groupBy({
        by: ["roomId", "roomProcess", "customProcessPhaseId"],
        where: { linkedStatus: coreRole },
      });
      for (const g of groups) {
        const cols = await tx.roomKanbanColumn.findMany({
          where: {
            roomId: g.roomId,
            roomProcess: g.customProcessPhaseId ? null : g.roomProcess,
            customProcessPhaseId: g.customProcessPhaseId,
            linkedStatus: coreRole,
          },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        });
        for (let i = 0; i < cols.length; i++) {
          const col = cols[i]!;
          await tx.roomKanbanColumn.update({
            where: { id: col.id },
            data:
              i === 0
                ? {
                    kind: KanbanColumnKind.CORE,
                    coreRole,
                  }
                : {
                    kind: KanbanColumnKind.CUSTOM,
                    coreRole: null,
                  },
          });
        }
      }
    }

    await tx.roomKanbanColumn.updateMany({
      where: {
        linkedStatus: { notIn: CORE_STATUSES },
      },
      data: { kind: KanbanColumnKind.CUSTOM, coreRole: null },
    });

    const rooms = await tx.room.findMany({ select: { id: true } });
    for (const room of rooms) {
      const hubPhases = [
        {
          roomId: room.id,
          roomProcess: RoomTaskProcess.MARKET_RESEARCH as RoomTaskProcess | null,
          customProcessPhaseId: null as string | null,
        },
      ];
      const customPhases = await tx.roomCustomProcessPhase.findMany({
        where: { roomId: room.id },
        select: { id: true },
      });
      for (const cp of customPhases) {
        hubPhases.push({
          roomId: room.id,
          roomProcess: null,
          customProcessPhaseId: cp.id,
        });
      }

      for (const phase of hubPhases) {
        for (let i = 0; i < CORE_STATUSES.length; i++) {
          const coreRole = CORE_STATUSES[i]!;
          const existing = await tx.roomKanbanColumn.findFirst({
            where: {
              roomId: phase.roomId,
              roomProcess: phase.customProcessPhaseId
                ? null
                : phase.roomProcess ?? undefined,
              customProcessPhaseId: phase.customProcessPhaseId,
              coreRole,
            },
          });
          if (existing) continue;

          const max = await tx.roomKanbanColumn.aggregate({
            where: {
              roomId: phase.roomId,
              roomProcess: phase.customProcessPhaseId
                ? null
                : phase.roomProcess ?? undefined,
              customProcessPhaseId: phase.customProcessPhaseId,
            },
            _max: { sortOrder: true },
          });

          await tx.roomKanbanColumn.create({
            data: {
              roomId: phase.roomId,
              roomProcess: phase.customProcessPhaseId
                ? null
                : phase.roomProcess,
              customProcessPhaseId: phase.customProcessPhaseId,
              kind: KanbanColumnKind.CORE,
              coreRole,
              linkedStatus: coreRole,
              title: taskStatusLabel(coreRole),
              sortOrder: (max._max.sortOrder ?? -1) + 1,
            },
          });
        }
      }
    }

    // Backfill Task.kanbanColumnId from status + phase
    const tasks = await tx.task.findMany({
      select: {
        id: true,
        status: true,
        kanbanColumnId: true,
        roomProcess: true,
        customProcessPhaseId: true,
        project: { select: { roomId: true } },
      },
    });

    for (const task of tasks) {
      if (task.kanbanColumnId) continue;

      const roomId = task.project.roomId;
      let column = await tx.roomKanbanColumn.findFirst({
        where: {
          roomId,
          customProcessPhaseId: task.customProcessPhaseId,
          roomProcess: task.customProcessPhaseId ? null : task.roomProcess,
          OR: [
            { coreRole: task.status, kind: KanbanColumnKind.CORE },
            { linkedStatus: task.status, kind: KanbanColumnKind.CUSTOM },
            { linkedStatus: task.status },
          ],
        },
        orderBy: [{ kind: "asc" }, { sortOrder: "asc" }],
      });

      if (!column && !CORE_STATUSES.includes(task.status)) {
        const max = await tx.roomKanbanColumn.aggregate({
          where: {
            roomId,
            customProcessPhaseId: task.customProcessPhaseId,
            roomProcess: task.customProcessPhaseId ? null : task.roomProcess,
          },
          _max: { sortOrder: true },
        });
        column = await tx.roomKanbanColumn.create({
          data: {
            roomId,
            roomProcess: task.customProcessPhaseId ? null : task.roomProcess,
            customProcessPhaseId: task.customProcessPhaseId,
            kind: KanbanColumnKind.CUSTOM,
            linkedStatus:
              task.status === TaskStatus.BLOCKED ||
              task.status === TaskStatus.IN_REVIEW
                ? task.status
                : TaskStatus.IN_PROGRESS,
            title: taskStatusLabel(task.status),
            sortOrder: (max._max.sortOrder ?? -1) + 1,
          },
        });
      }

      if (!column) {
        column = await tx.roomKanbanColumn.findFirst({
          where: {
            roomId,
            customProcessPhaseId: task.customProcessPhaseId,
            roomProcess: task.customProcessPhaseId ? null : task.roomProcess,
            coreRole: TaskStatus.IN_PROGRESS,
          },
        });
      }

      if (!column) {
        throw new Error(`No column for task ${task.id} status ${task.status}`);
      }

      await tx.task.update({
        where: { id: task.id },
        data: { kanbanColumnId: column.id },
      });
    }
  });

  const afterTasks = await prisma.task.count();
  const nullCols = await prisma.task.count({
    where: { kanbanColumnId: null },
  });
  console.log(`After tasks: ${afterTasks}, without column: ${nullCols}`);
  if (afterTasks !== baselineTasks) {
    throw new Error(`Task count changed: ${baselineTasks} -> ${afterTasks}`);
  }
  if (nullCols > 0) {
    throw new Error(`${nullCols} tasks still missing kanbanColumnId`);
  }
  console.log("Backfill complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
