import type { TaskStatus } from "@prisma/client";

export type KanbanSortableTask = {
  id: string;
  status: TaskStatus;
  kanbanColumnId?: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  kanbanSortKey?: number | null;
};

/** Manual `sortKey` first (lower = top); sisanya `updatedAt` desc, lalu `createdAt` desc. */
export function sortTasksForKanbanColumn<T extends KanbanSortableTask>(
  tasks: T[],
  columnId: string,
): T[] {
  return [...tasks]
    .filter((t) => t.kanbanColumnId === columnId)
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
      return new Date(b.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
}

/** Legacy: group by status when column id mode is off. */
export function sortTasksForKanbanStatus<T extends KanbanSortableTask>(
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
      return new Date(b.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
}

export function kanbanSortKeysFromPositions(
  positions: { columnId: string; sortKey: number }[],
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of positions) {
    out[p.columnId] = p.sortKey;
  }
  return out;
}

/** @deprecated status-based positions */
export function kanbanSortKeysFromStatusPositions(
  positions: { status: TaskStatus; sortKey: number }[],
): Partial<Record<TaskStatus, number>> {
  const out: Partial<Record<TaskStatus, number>> = {};
  for (const p of positions) {
    out[p.status] = p.sortKey;
  }
  return out;
}
