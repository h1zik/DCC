import {
  SeoAnalysisStatus,
  SeoIssueSeverity,
  SeoKeywordIntent,
  SeoRankDevice,
} from "@prisma/client";

/** Label Bahasa Indonesia untuk intent keyword. */
export const SEO_INTENT_LABELS: Record<SeoKeywordIntent, string> = {
  INFORMATIONAL: "Informasional",
  COMMERCIAL: "Komersial",
  TRANSACTIONAL: "Transaksional",
  NAVIGATIONAL: "Navigasional",
  UNKNOWN: "Tak diketahui",
};

export const SEO_STATUS_LABELS: Record<SeoAnalysisStatus, string> = {
  PENDING: "Menunggu",
  COLLECTING: "Mengumpulkan",
  ANALYZING: "Menganalisis",
  READY: "Siap",
  FAILED: "Gagal",
};

export const SEO_DEVICE_LABELS: Record<SeoRankDevice, string> = {
  DESKTOP: "Desktop",
  MOBILE: "Mobile",
};

export const SEO_SEVERITY_LABELS: Record<SeoIssueSeverity, string> = {
  CRITICAL: "Kritis",
  HIGH: "Tinggi",
  MEDIUM: "Sedang",
  LOW: "Rendah",
  INFO: "Info",
};

/** Variant Badge per severity (untuk daftar isu). */
export const SEO_SEVERITY_BADGE: Record<
  SeoIssueSeverity,
  "default" | "secondary" | "destructive" | "outline"
> = {
  CRITICAL: "destructive",
  HIGH: "destructive",
  MEDIUM: "secondary",
  LOW: "outline",
  INFO: "outline",
};

/** Warna teks skor 0-100 (hijau→merah). */
export function scoreToneClass(score: number | null | undefined): string {
  if (score == null) return "text-muted-foreground";
  if (score >= 80) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 50) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

/** Status yang masih berproses (untuk polling UI). */
export function isSeoStatusBusy(status: SeoAnalysisStatus): boolean {
  return (
    status === SeoAnalysisStatus.PENDING ||
    status === SeoAnalysisStatus.COLLECTING ||
    status === SeoAnalysisStatus.ANALYZING
  );
}

/**
 * Batas usia run "sibuk" sebelum dianggap macet (15 menit). Pipeline SEO
 * berjalan di `after()`; bila proses server restart di tengah jalan tidak ada
 * `catch` yang menulis FAILED, sehingga status busy tanpa `updatedAt` bergerak
 * selama ini hampir pasti berarti proses sudah mati.
 */
export const SEO_STALE_RUN_MS = 15 * 60 * 1000;

/**
 * True bila run berstatus busy tetapi tidak ada aktivitas tulis selama
 * `SEO_STALE_RUN_MS`. Dipakai UI untuk membuka kembali tombol pemulihan dan
 * oleh sapuan cron untuk menandai FAILED.
 */
export function isSeoRunStale(
  status: SeoAnalysisStatus,
  updatedAt: Date | string,
  now: number = Date.now(),
): boolean {
  if (!isSeoStatusBusy(status)) return false;
  const t = typeof updatedAt === "string" ? Date.parse(updatedAt) : updatedAt.getTime();
  if (!Number.isFinite(t)) return false;
  return now - t > SEO_STALE_RUN_MS;
}

/** Pesan error standar untuk run yang ditandai macet. */
export const SEO_STALE_RUN_MESSAGE =
  "Proses terhenti tanpa hasil (kemungkinan server restart saat berjalan). Jalankan ulang.";

/** Label posisi ranking yang ramah (null = di luar top 100). */
export function formatRankPosition(position: number | null | undefined): string {
  if (position == null) return "—";
  return `#${position}`;
}
