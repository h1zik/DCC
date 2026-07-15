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
 * `Task.status` adalah KATEGORI TURUNAN, bukan sumber kebenaran posisi:
 * posisi kartu ditentukan `kanbanColumnId`, kategorinya `statusForColumn`
 * (bucket kolom). OVERDUE bukan lajur/tahap — ia overlay berbasis waktu di
 * atas bucket TODO/IN_PROGRESS agar konsumen pelaporan (home, AI API, digest)
 * tetap bisa query `status = OVERDUE`.
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
  // OVERDUE tidak boleh jadi bucket tersimpan; kalau bocor dari data lama,
  // runtuhkan ke IN_PROGRESS kecuali memang masih telat.
  if (bucket === TaskStatus.OVERDUE) {
    return isTaskLate(dueDate, now) ? TaskStatus.OVERDUE : TaskStatus.IN_PROGRESS;
  }
  return bucket;
}

/** Bucket tersimpan (non-OVERDUE) dari status lama — untuk auto-lepas. */
export function bucketFromLegacyStatus(status: TaskStatus): TaskStatus {
  return status === TaskStatus.OVERDUE ? TaskStatus.IN_PROGRESS : status;
}
