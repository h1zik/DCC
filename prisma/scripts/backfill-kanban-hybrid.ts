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
    // Mark existing default columns as CORE
    for (const coreRole of CORE_STATUSES) {
      await tx.roomKanbanColumn.updateMany({
        where: { linkedStatus: coreRole, coreRole: null },
        data: {
          kind: KanbanColumnKind.CORE,
          coreRole,
        },
      });
    }

    await tx.roomKanbanColumn.updateMany({
      where: {
        kind: KanbanColumnKind.CUSTOM,
        coreRole: { not: null },
      },
      data: { kind: KanbanColumnKind.CORE },
    });

    await tx.roomKanbanColumn.updateMany({
      where: {
        coreRole: null,
        linkedStatus: { notIn: CORE_STATUSES },
      },
      data: { kind: KanbanColumnKind.CUSTOM },
    });

    const legacyCore = await tx.roomKanbanColumn.findMany({
      where: {
        coreRole: null,
        linkedStatus: { in: CORE_STATUSES },
      },
    });
    for (const col of legacyCore) {
      await tx.roomKanbanColumn.update({
        where: { id: col.id },
        data: {
          kind: KanbanColumnKind.CORE,
          coreRole: col.linkedStatus,
        },
      });
    }

    // Seed missing CORE columns per distinct room+phase
    const phaseKeys = await tx.roomKanbanColumn.findMany({
      select: {
        roomId: true,
        roomProcess: true,
        customProcessPhaseId: true,
      },
      distinct: ["roomId", "roomProcess", "customProcessPhaseId"],
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
