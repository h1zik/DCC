import { ContentPlanTaskKind } from "@prisma/client";

/**
 * Helper bersama (client + server) untuk sisi pekerjaan Content Planning yang
 * diwakili sebuah tugas Kanban: Copy atau Design.
 */

export const CONTENT_PLAN_TASK_KINDS: ContentPlanTaskKind[] = [
  ContentPlanTaskKind.COPYWRITING,
  ContentPlanTaskKind.DESIGN,
];

export function contentPlanTaskKindLabel(kind: ContentPlanTaskKind): string {
  switch (kind) {
    case ContentPlanTaskKind.COPYWRITING:
      return "Copy";
    case ContentPlanTaskKind.DESIGN:
      return "Design";
    default:
      return kind;
  }
}

/**
 * Tugas yang dibuat sebelum ada tugas copy tidak menyimpan jenis; semuanya
 * adalah tugas design. Pakai ini setiap kali membaca `Task.contentPlanKind`.
 */
export function contentPlanTaskKindOrDefault(
  kind: ContentPlanTaskKind | null | undefined,
): ContentPlanTaskKind {
  return kind ?? ContentPlanTaskKind.DESIGN;
}
