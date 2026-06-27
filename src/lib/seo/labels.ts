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

/** Label posisi ranking yang ramah (null = di luar top 100). */
export function formatRankPosition(position: number | null | undefined): string {
  if (position == null) return "—";
  return `#${position}`;
}
