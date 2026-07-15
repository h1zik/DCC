import { TaskStatus } from "@prisma/client";

const JAKARTA_TZ = "Asia/Jakarta";

/** Kunci hari kalender WIB (YYYY-MM-DD) — perbandingan overdue per-hari, bukan per-jam. */
export function toJakartaDayKey(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: JAKARTA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((p) => p.type === "year")?.value ?? "0000";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

/** Aturan bisnis: due 27 Apr baru telat saat sudah masuk 28 Apr (WIB). */
export function isTaskLate(
  dueDate: Date | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!dueDate) return false;
  return toJakartaDayKey(dueDate) < toJakartaDayKey(now);
}

/**
 * `Task.status` adalah KATEGORI TURUNAN: posisi kartu ditentukan
 * `kanbanColumnId` (Tahap), kategorinya dari bucket kolom (`statusForColumn`).
 *
 * Kolom "Overdue" adalah LAJUR SISTEM yang dikelola deadline:
 * - bucket TODO/IN_PROGRESS + lewat tenggat → OVERDUE (cron/edit memindahkan
 *   kartunya ke lajur Overdue);
 * - bucket OVERDUE (kartu di lajur) + tenggat diundur ke masa depan →
 *   IN_PROGRESS (auto-lepas; kartu kembali ke "Berjalan");
 * - bucket OVERDUE tanpa tenggat → tetap OVERDUE (penandaan manual dibiarkan).
 *
 * Semua jalur tulis status (moveTaskToColumn, updateTask, agent, cron) wajib
 * lewat fungsi ini supaya status & kolom tidak pernah saling bertentangan.
 */
export function effectiveTaskStatus(
  bucket: TaskStatus,
  dueDate: Date | null | undefined,
  now: Date = new Date(),
): TaskStatus {
  if (
    (bucket === TaskStatus.TODO || bucket === TaskStatus.IN_PROGRESS) &&
    isTaskLate(dueDate, now)
  ) {
    return TaskStatus.OVERDUE;
  }
  if (bucket === TaskStatus.OVERDUE) {
    // Auto-lepas hanya bila ada tenggat baru di masa depan; tanpa tenggat,
    // hormati penempatan di lajur Overdue.
    return dueDate != null && !isTaskLate(dueDate, now)
      ? TaskStatus.IN_PROGRESS
      : TaskStatus.OVERDUE;
  }
  return bucket;
}
