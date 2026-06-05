import type { AgentTaskSummary } from "./types";

export function formatPhaseRequiredForCreateMessage(
  roomName: string,
  accessiblePhases: string[],
): string {
  const list = accessiblePhases.map((p) => `• ${p}`).join("\n");
  return [
    `NEED_PHASE: User punya akses ke ${accessiblePhases.length} fase di ruangan "${roomName}" tapi belum menyebut fase proses.`,
    "Tanyakan ke user mau ditambahkan ke fase mana:",
    list,
    "Setelah user memilih, panggil create_task_in_room lagi dengan processPhaseNameOrId yang sesuai.",
  ].join("\n");
}

const BULK_TITLE_PATTERN = /^(semua|all|semua tugas|tugas-tugas)$/i;

export function isBulkTaskTitleSearch(raw: string): boolean {
  return BULK_TITLE_PATTERN.test(raw.trim());
}

export function formatDeleteConfirmationMessage(
  roomName: string,
  tasks: AgentTaskSummary[],
): string {
  const lines = tasks.map(
    (t) =>
      `• "${t.title}" (${t.phaseName ?? "—"}, ${t.statusLabel})`,
  );
  return [
    `NEED_DELETE_CONFIRM: ${tasks.length} tugas akan **DIHAPUS PERMANEN** di ruangan "${roomName}".`,
    "Tampilkan daftar ini ke user dan minta konfirmasi eksplisit (ya / konfirmasi / hapus saja).",
    ...lines,
    "Setelah user konfirmasi, panggil tool delete lagi dengan confirmed: true.",
  ].join("\n");
}

export function formatDuplicateTaskMessage(
  roomName: string,
  tasks: AgentTaskSummary[],
): string {
  const title = tasks[0]?.title ?? "tugas";
  const options = tasks.map((t) => {
    const pic =
      t.assignees.length > 0 ? `, PIC: ${t.assignees.join(", ")}` : "";
    const due = t.dueDate
      ? `, deadline: ${t.dueDate.slice(0, 10)}`
      : "";
    return `• "${t.title}" di fase **${t.phaseName ?? "—"}** (status: ${t.statusLabel}${pic}${due})`;
  });

  return [
    `SUGGEST_TASK: Ada ${tasks.length} tugas bernama "${title}" di ruangan "${roomName}".`,
    "Tanyakan ke user maksud yang mana berdasarkan fase proses:",
    ...options,
    "Setelah user memilih fase, panggil move_task_in_room lagi dengan processPhaseNameOrId yang sesuai.",
  ].join("\n");
}
