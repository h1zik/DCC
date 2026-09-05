import {
  ContentPlanFeedVisibility,
  ContentPlanPlatform,
  ContentPlanStatusKerja,
} from "@prisma/client";

/**
 * Aturan keikutsertaan & urutan tile di simulasi feed Instagram (Content Plan).
 * Dipisah dari komponen supaya bisa diuji tanpa React.
 */

export type FeedPrefs = {
  includeArchived: boolean;
  instagramOnly: boolean;
  includeUndated: boolean;
};

export type FeedMembershipRow = {
  feedVisibility: ContentPlanFeedVisibility;
  archivedAt: Date | string | null;
  platforms: ContentPlanPlatform[];
  tanggalPosting: Date | string | null;
  jamPosting: string | null;
};

export type FeedExclusionReason = "hidden" | "archived" | "platform" | "undated";

export const FEED_EXCLUSION_LABEL: Record<FeedExclusionReason, string> = {
  hidden: "Dihapus dari feed",
  archived: "Arsip",
  platform: "Bukan Instagram",
  undated: "Tanpa tanggal",
};

function toDate(v: Date | string | null | undefined): Date | null {
  if (!v) return null;
  const d = typeof v === "string" ? new Date(v) : v;
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Waktu tayang efektif (ms lokal): tanggal posting + jam posting. null = belum dijadwalkan. */
export function contentPlanFeedPostingTime(row: {
  tanggalPosting: Date | string | null;
  jamPosting: string | null;
}): number | null {
  const d = toDate(row.tanggalPosting);
  if (!d) return null;
  const base = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const m = /^(\d{2}):(\d{2})$/.exec(row.jamPosting ?? "");
  const minutes = m ? Number(m[1]) * 60 + Number(m[2]) : 0;
  return base + minutes * 60_000;
}

export function contentPlanFeedIsPublished(row: {
  archivedAt: Date | string | null;
  statusCopywriting: ContentPlanStatusKerja;
  statusDesign: ContentPlanStatusKerja;
}): boolean {
  if (row.archivedAt) return true;
  return (
    row.statusCopywriting === ContentPlanStatusKerja.DIPUBLIKASIKAN &&
    row.statusDesign === ContentPlanStatusKerja.DIPUBLIKASIKAN
  );
}

/**
 * Alasan baris TIDAK tampil di feed, atau null bila tampil.
 * HIDDEN selalu keluar, SHOWN selalu masuk, AUTO mengikuti preferensi profil.
 */
export function contentPlanFeedExclusionReason(
  row: FeedMembershipRow,
  prefs: FeedPrefs,
): FeedExclusionReason | null {
  if (row.feedVisibility === ContentPlanFeedVisibility.HIDDEN) return "hidden";
  if (row.feedVisibility === ContentPlanFeedVisibility.SHOWN) return null;
  if (!prefs.includeArchived && row.archivedAt) return "archived";
  const platforms = row.platforms ?? [];
  if (
    prefs.instagramOnly &&
    platforms.length > 0 &&
    !platforms.includes(ContentPlanPlatform.INSTAGRAM)
  ) {
    return "platform";
  }
  if (!prefs.includeUndated && contentPlanFeedPostingTime(row) == null) return "undated";
  return null;
}

export type FeedOrderRow = {
  id: string;
  /** Posisi manual (0 = kiri atas); null = otomatis ikut tanggal. */
  feedPosition: number | null;
  /** Hasil contentPlanFeedPostingTime; null = tanpa tanggal. */
  postingTime: number | null;
};

/**
 * Urutan otomatis: tanpa tanggal paling atas (rencana berikutnya), lalu
 * terbaru → terlama. Seri mengikuti urutan input (urutan tabel).
 */
export function sortContentPlanFeedAuto<T extends FeedOrderRow>(rows: readonly T[]): T[] {
  return rows
    .map((r, i) => ({ r, i }))
    .sort((a, b) => {
      const ta = a.r.postingTime;
      const tb = b.r.postingTime;
      if (ta == null && tb == null) return a.i - b.i;
      if (ta == null) return -1;
      if (tb == null) return 1;
      if (tb !== ta) return tb - ta;
      return a.i - b.i;
    })
    .map((k) => k.r);
}

/**
 * Gabungkan posisi manual dengan urutan otomatis.
 *
 * Baris berposisi manual menjadi tulang punggung (urut `feedPosition`).
 * Baris tanpa posisi (baru dibuat, baru ditampilkan lagi, atau semua baris
 * saat belum pernah digeser) disisipkan mengikuti tanggalnya: tepat sebelum
 * baris manual pertama yang lebih lama darinya; tanpa tanggal ditaruh paling
 * atas. Dengan begitu satu kali geser tidak "mengunci" baris lain yang datang
 * belakangan ke posisi yang aneh.
 */
export function mergeContentPlanFeedOrder<T extends FeedOrderRow>(rows: readonly T[]): T[] {
  const manual = rows
    .map((r, i) => ({ r, i }))
    .filter((k) => k.r.feedPosition != null)
    .sort((a, b) => {
      const pa = a.r.feedPosition as number;
      const pb = b.r.feedPosition as number;
      return pa !== pb ? pa - pb : a.i - b.i;
    })
    .map((k) => k.r);
  const auto = sortContentPlanFeedAuto(rows.filter((r) => r.feedPosition == null));
  if (manual.length === 0) return auto;

  const out: T[] = [...manual];
  // Proses dari yang paling bawah (terlama) ke atas supaya baris otomatis yang
  // seharusnya berurutan tidak saling mendahului saat disisipkan di index sama.
  for (let k = auto.length - 1; k >= 0; k -= 1) {
    const r = auto[k]!;
    let insertAt = 0;
    if (r.postingTime != null) {
      insertAt = out.length;
      for (let i = 0; i < out.length; i += 1) {
        const t = out[i]!.postingTime;
        if (t != null && t < r.postingTime) {
          insertAt = i;
          break;
        }
      }
    }
    out.splice(insertAt, 0, r);
  }
  return out;
}
