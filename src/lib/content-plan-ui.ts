import {
  ContentPlanJenis,
  ContentPlanPlatform,
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

/** Urutan tampil platform (tabel, form, filter): yang paling sering dipakai di depan. */
export const PLATFORM_ORDER: ContentPlanPlatform[] = [
  ContentPlanPlatform.INSTAGRAM,
  ContentPlanPlatform.TIKTOK,
  ContentPlanPlatform.THREADS,
  ContentPlanPlatform.FACEBOOK,
  ContentPlanPlatform.YOUTUBE,
  ContentPlanPlatform.X,
  ContentPlanPlatform.LINKEDIN,
];

export const PLATFORM_LABEL: Record<ContentPlanPlatform, string> = {
  [ContentPlanPlatform.INSTAGRAM]: "Instagram",
  [ContentPlanPlatform.TIKTOK]: "TikTok",
  [ContentPlanPlatform.THREADS]: "Threads",
  [ContentPlanPlatform.FACEBOOK]: "Facebook",
  [ContentPlanPlatform.YOUTUBE]: "YouTube",
  [ContentPlanPlatform.X]: "X",
  [ContentPlanPlatform.LINKEDIN]: "LinkedIn",
};

/** Singkatan untuk badge sempit di tabel. */
export const PLATFORM_SHORT_LABEL: Record<ContentPlanPlatform, string> = {
  [ContentPlanPlatform.INSTAGRAM]: "IG",
  [ContentPlanPlatform.TIKTOK]: "TT",
  [ContentPlanPlatform.THREADS]: "TH",
  [ContentPlanPlatform.FACEBOOK]: "FB",
  [ContentPlanPlatform.YOUTUBE]: "YT",
  [ContentPlanPlatform.X]: "X",
  [ContentPlanPlatform.LINKEDIN]: "IN",
};

export const PLATFORM_BADGE_CLASS: Record<ContentPlanPlatform, string> = {
  [ContentPlanPlatform.INSTAGRAM]:
    "border-pink-500/35 bg-pink-500/12 text-pink-700 dark:text-pink-300",
  [ContentPlanPlatform.TIKTOK]:
    "border-slate-700/40 bg-slate-700/12 text-slate-800 dark:border-slate-300/40 dark:text-slate-200",
  [ContentPlanPlatform.THREADS]:
    "border-zinc-500/35 bg-zinc-500/12 text-zinc-700 dark:text-zinc-300",
  [ContentPlanPlatform.FACEBOOK]:
    "border-blue-600/35 bg-blue-600/12 text-blue-700 dark:text-blue-300",
  [ContentPlanPlatform.YOUTUBE]:
    "border-red-500/35 bg-red-500/12 text-red-700 dark:text-red-300",
  [ContentPlanPlatform.X]:
    "border-neutral-600/35 bg-neutral-600/12 text-neutral-800 dark:text-neutral-200",
  [ContentPlanPlatform.LINKEDIN]:
    "border-sky-700/35 bg-sky-700/12 text-sky-800 dark:text-sky-300",
};

/** Path publik file design yang bisa dirender sebagai gambar di preview/feed. */
export function isContentPlanImagePath(publicPath: string): boolean {
  const lower = publicPath.split("?")[0]?.toLowerCase() ?? "";
  return /\.(png|jpe?g|gif|webp|avif|svg)$/i.test(lower);
}

/** Path publik file design yang bisa dirender sebagai video di preview/feed. */
export function isContentPlanVideoPath(publicPath: string): boolean {
  const lower = publicPath.split("?")[0]?.toLowerCase() ?? "";
  return /\.(mp4|webm|mov|m4v|ogg)$/i.test(lower);
}

/**
 * Cover yang dipakai di grid simulasi feed: cover kustom menang, lalu slide
 * design ke-`feedCoverIndex` (di-clamp bila slide sudah dihapus), lalu null.
 */
export function contentPlanFeedCoverPath(row: {
  designFilePaths: string[];
  feedCoverIndex: number;
  feedCoverPath: string | null;
}): string | null {
  const custom = row.feedCoverPath?.trim();
  if (custom) return custom;
  const slides = row.designFilePaths ?? [];
  if (slides.length === 0) return null;
  const idx = Math.max(0, Math.min(row.feedCoverIndex ?? 0, slides.length - 1));
  return slides[idx] ?? null;
}

/** Urutkan daftar platform sesuai PLATFORM_ORDER, buang duplikat dan nilai asing. */
export function sortPlatforms(
  list: readonly ContentPlanPlatform[] | null | undefined,
): ContentPlanPlatform[] {
  const set = new Set(list ?? []);
  return PLATFORM_ORDER.filter((p) => set.has(p));
}

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
