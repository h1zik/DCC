import { TaskStatus } from "@prisma/client";

export function taskStatusLabel(s: TaskStatus): string {
  switch (s) {
    case TaskStatus.TODO:
      return "To-Do";
    case TaskStatus.IN_PROGRESS:
      return "Berjalan";
    case TaskStatus.OVERDUE:
      return "Overdue";
    case TaskStatus.DONE:
      return "Selesai";
    case TaskStatus.BLOCKED:
      return "Diblokir";
    case TaskStatus.IN_REVIEW:
      return "Dalam review";
    default:
      return String(s);
  }
}

/** Urutan default kolom saat inisialisasi papan (bukan semua harus ada). */
export const DEFAULT_KANBAN_STATUSES: TaskStatus[] = [
  TaskStatus.TODO,
  TaskStatus.IN_PROGRESS,
  TaskStatus.OVERDUE,
  TaskStatus.DONE,
];

/** Status yang wajib punya kolom (tidak boleh dihapus dari pengaturan papan). */
export function isDefaultKanbanLinkedStatus(s: TaskStatus): boolean {
  return DEFAULT_KANBAN_STATUSES.includes(s);
}
