import type { TaskStatus } from "@prisma/client";

export type KanbanSortableTask = {
  id: string;
  status: TaskStatus;
  createdAt: Date | string;
  updatedAt: Date | string;
  kanbanSortKey?: number | null;
};

/** Manual `sortKey` first (lower = top); sisanya `updatedAt` desc, lalu `createdAt` desc. */
export function sortTasksForKanbanColumn<T extends KanbanSortableTask>(
  tasks: T[],
  status: TaskStatus,
): T[] {
  return [...tasks]
    .filter((t) => t.status === status)
    .sort((a, b) => {
      const aKey = a.kanbanSortKey;
      const bKey = b.kanbanSortKey;
      const aManual = aKey != null;
      const bManual = bKey != null;
      if (aManual && bManual) return aKey - bKey;
      if (aManual !== bManual) return aManual ? -1 : 1;
      const aUpdated = new Date(a.updatedAt).getTime();
      const bUpdated = new Date(b.updatedAt).getTime();
      if (aUpdated !== bUpdated) return bUpdated - aUpdated;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
}

export function kanbanSortKeysFromPositions(
  positions: { status: TaskStatus; sortKey: number }[],
): Partial<Record<TaskStatus, number>> {
  const out: Partial<Record<TaskStatus, number>> = {};
  for (const p of positions) {
    out[p.status] = p.sortKey;
  }
  return out;
}
