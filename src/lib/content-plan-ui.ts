import {
  ContentPlanJenis,
  ContentPlanStatusKerja,
  ContentPlanUsage,
} from "@prisma/client";

/**
 * Label & kelas badge Content Planning. Dipisah dari komponen agar tampilan
 * tabel dan Gantt memakai kosakata warna yang sama.
 */

export const JENIS_LABEL: Record<ContentPlanJenis, string> = {
  [ContentPlanJenis.REELS]: "Reels",
  [ContentPlanJenis.CAROUSEL]: "Carousel",
  [ContentPlanJenis.SINGLE_FEED]: "Single Feed",
};

export const STATUS_LABEL: Record<ContentPlanStatusKerja, string> = {
  [ContentPlanStatusKerja.BARU]: "Baru",
  [ContentPlanStatusKerja.DALAM_PROSES]: "Dalam Proses",
  [ContentPlanStatusKerja.DALAM_PENINJAUAN]: "Dalam Peninjauan",
  [ContentPlanStatusKerja.DIPUBLIKASIKAN]: "Dipublikasikan",
  [ContentPlanStatusKerja.DITANGGUHKAN]: "Ditangguhkan",
  [ContentPlanStatusKerja.DIJEDA]: "Dijeda",
};

export const USAGE_LABEL: Record<ContentPlanUsage, string> = {
  [ContentPlanUsage.AWARENESS]: "Awareness",
  [ContentPlanUsage.CONSIDERATION]: "Consideration",
  [ContentPlanUsage.CONVERSION]: "Conversion",
};

export const JENIS_BADGE_CLASS: Record<ContentPlanJenis, string> = {
  [ContentPlanJenis.REELS]:
    "border-fuchsia-500/35 bg-fuchsia-500/12 text-fuchsia-700 dark:text-fuchsia-300",
  [ContentPlanJenis.CAROUSEL]:
    "border-sky-500/35 bg-sky-500/12 text-sky-700 dark:text-sky-300",
  [ContentPlanJenis.SINGLE_FEED]:
    "border-amber-500/35 bg-amber-500/12 text-amber-700 dark:text-amber-300",
};

export const USAGE_BADGE_CLASS: Record<ContentPlanUsage, string> = {
  [ContentPlanUsage.AWARENESS]:
    "border-cyan-500/35 bg-cyan-500/12 text-cyan-800 dark:text-cyan-300",
  [ContentPlanUsage.CONSIDERATION]:
    "border-violet-500/35 bg-violet-500/12 text-violet-800 dark:text-violet-300",
  [ContentPlanUsage.CONVERSION]:
    "border-emerald-500/35 bg-emerald-500/12 text-emerald-800 dark:text-emerald-300",
};

export const STATUS_BADGE_CLASS: Record<ContentPlanStatusKerja, string> = {
  [ContentPlanStatusKerja.BARU]:
    "border-slate-500/35 bg-slate-500/12 text-slate-700 dark:text-slate-300",
  [ContentPlanStatusKerja.DALAM_PROSES]:
    "border-blue-500/35 bg-blue-500/12 text-blue-700 dark:text-blue-300",
  [ContentPlanStatusKerja.DALAM_PENINJAUAN]:
    "border-violet-500/35 bg-violet-500/12 text-violet-700 dark:text-violet-300",
  [ContentPlanStatusKerja.DIPUBLIKASIKAN]:
    "border-emerald-500/35 bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
  [ContentPlanStatusKerja.DITANGGUHKAN]:
    "border-rose-500/35 bg-rose-500/12 text-rose-700 dark:text-rose-300",
  [ContentPlanStatusKerja.DIJEDA]:
    "border-amber-500/35 bg-amber-500/12 text-amber-700 dark:text-amber-300",
};

/** Warna bar Gantt per status kerja — satu keluarga hue dengan badge di atas. */
export const STATUS_BAR_CLASS: Record<
  ContentPlanStatusKerja,
  { dot: string; base: string; border: string; fill: string; text: string }
> = {
  [ContentPlanStatusKerja.BARU]: {
    dot: "bg-slate-400",
    base: "bg-slate-500/12 dark:bg-slate-400/15",
    border: "border-slate-500/35 dark:border-slate-400/35",
    fill: "bg-slate-500/30 dark:bg-slate-400/35",
    text: "text-slate-700 dark:text-slate-200",
  },
  [ContentPlanStatusKerja.DALAM_PROSES]: {
    dot: "bg-blue-500",
    base: "bg-blue-500/12",
    border: "border-blue-500/40",
    fill: "bg-blue-500/35",
    text: "text-blue-800 dark:text-blue-200",
  },
  [ContentPlanStatusKerja.DALAM_PENINJAUAN]: {
    dot: "bg-violet-500",
    base: "bg-violet-500/12",
    border: "border-violet-500/40",
    fill: "bg-violet-500/35",
    text: "text-violet-800 dark:text-violet-200",
  },
  [ContentPlanStatusKerja.DIPUBLIKASIKAN]: {
    dot: "bg-emerald-500",
    base: "bg-emerald-500/12",
    border: "border-emerald-500/40",
    fill: "bg-emerald-500/35",
    text: "text-emerald-800 dark:text-emerald-200",
  },
  [ContentPlanStatusKerja.DITANGGUHKAN]: {
    dot: "bg-rose-500",
    base: "bg-rose-500/12",
    border: "border-rose-500/40",
    fill: "bg-rose-500/35",
    text: "text-rose-800 dark:text-rose-200",
  },
  [ContentPlanStatusKerja.DIJEDA]: {
    dot: "bg-amber-500",
    base: "bg-amber-500/12",
    border: "border-amber-500/40",
    fill: "bg-amber-500/35",
    text: "text-amber-800 dark:text-amber-200",
  },
};

/** Bobot progres kasar per status, dipakai untuk bar progres baris Gantt. */
export const STATUS_PROGRESS_PCT: Record<ContentPlanStatusKerja, number> = {
  [ContentPlanStatusKerja.BARU]: 0,
  [ContentPlanStatusKerja.DALAM_PROSES]: 45,
  [ContentPlanStatusKerja.DALAM_PENINJAUAN]: 80,
  [ContentPlanStatusKerja.DIPUBLIKASIKAN]: 100,
  [ContentPlanStatusKerja.DITANGGUHKAN]: 0,
  [ContentPlanStatusKerja.DIJEDA]: 25,
};
