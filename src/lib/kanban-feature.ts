/** Rollout flag: board groups by `kanbanColumnId` instead of `status` only. */
export function kanbanUsesColumnId(): boolean {
  return process.env.KANBAN_USE_COLUMN_ID !== "false";
}
