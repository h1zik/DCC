/**
 * Maps a module's coarse status enum to a {percent, label} pair for the shared
 * JobProgressBar. Lets us show a real progress bar for AI pipelines that don't
 * persist a numeric percent, by deriving it from the lifecycle stage.
 */
export type StatusProgress = { percent: number; label: string };

const STAGE_MAP: Record<string, StatusProgress> = {
  PENDING: { percent: 8, label: "Menyiapkan job…" },
  SCRAPING: { percent: 35, label: "Mengambil data dari sumber…" },
  COLLECTING: { percent: 35, label: "Mengumpulkan sinyal pasar…" },
  GATHERING: { percent: 30, label: "Menggabungkan konteks lintas-modul…" },
  ANALYZING: { percent: 70, label: "Menganalisis dengan AI…" },
  VALIDATING: { percent: 70, label: "Memvalidasi konsep dengan AI…" },
  GENERATING: { percent: 65, label: "Menyusun laporan…" },
  READY: { percent: 100, label: "Selesai" },
  COMPLETED: { percent: 100, label: "Selesai" },
  FAILED: { percent: 100, label: "Gagal" },
};

export function statusToProgress(status: string): StatusProgress {
  return STAGE_MAP[status] ?? { percent: 20, label: "Memproses…" };
}

export function isInProgressStatus(status: string): boolean {
  return [
    "PENDING",
    "SCRAPING",
    "COLLECTING",
    "GATHERING",
    "ANALYZING",
    "VALIDATING",
    "GENERATING",
  ].includes(status);
}
