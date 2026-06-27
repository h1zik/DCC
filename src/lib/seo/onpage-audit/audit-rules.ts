import { SeoIssueSeverity } from "@prisma/client";

/**
 * Aturan & skoring On-Page Audit. Pure (tanpa dependensi server) agar mudah
 * di-test. Analyzer menyiapkan `AuditInput` dari DataForSEO + parsing HTML.
 */

export type AuditInput = {
  /** Skor On-Page DataForSEO (referensi, tidak dipakai untuk skor headline). */
  onpageScore: number | null;
  title: string | null;
  description: string | null;
  h1Count: number;
  wordCount: number | null;
  hasSchema: boolean | null;
  /** Boolean checks dari DataForSEO instant_pages. */
  checks: Record<string, boolean>;
  targetKeyword: string | null;
  keywordInTitle: boolean | null;
  keywordInDescription: boolean | null;
  keywordInH1: boolean | null;
  imagesWithoutAlt: number | null;
};

export type AuditIssue = {
  type: string;
  severity: SeoIssueSeverity;
  message: string;
  recommendation: string;
};

type CheckRule = {
  key: string;
  /** Nilai check yang menandakan masalah. */
  problemWhen: boolean;
  severity: SeoIssueSeverity;
  message: string;
  recommendation: string;
};

/** Aturan berbasis boolean checks DataForSEO instant_pages. */
const CHECK_RULES: CheckRule[] = [
  {
    key: "no_title",
    problemWhen: true,
    severity: SeoIssueSeverity.CRITICAL,
    message: "Tidak ada title tag.",
    recommendation: "Tambahkan <title> unik 50–60 karakter dengan keyword utama.",
  },
  {
    key: "is_4xx_code",
    problemWhen: true,
    severity: SeoIssueSeverity.CRITICAL,
    message: "Halaman mengembalikan status 4xx.",
    recommendation: "Perbaiki URL atau redirect ke halaman yang valid.",
  },
  {
    key: "is_5xx_code",
    problemWhen: true,
    severity: SeoIssueSeverity.CRITICAL,
    message: "Halaman error server (5xx).",
    recommendation: "Perbaiki error server agar halaman dapat diindeks.",
  },
  {
    key: "no_h1_tag",
    problemWhen: true,
    severity: SeoIssueSeverity.HIGH,
    message: "Tidak ada heading H1.",
    recommendation: "Tambahkan satu H1 deskriptif yang memuat keyword utama.",
  },
  {
    key: "no_description",
    problemWhen: true,
    severity: SeoIssueSeverity.HIGH,
    message: "Tidak ada meta description.",
    recommendation: "Tulis meta description 120–160 karakter yang persuasif.",
  },
  {
    key: "https",
    problemWhen: false,
    severity: SeoIssueSeverity.HIGH,
    message: "Halaman tidak memakai HTTPS.",
    recommendation: "Pindahkan situs ke HTTPS dan paksa redirect dari HTTP.",
  },
  {
    key: "duplicate_title_tag",
    problemWhen: true,
    severity: SeoIssueSeverity.MEDIUM,
    message: "Title tag duplikat dengan halaman lain.",
    recommendation: "Buat title unik per halaman.",
  },
  {
    key: "title_too_long",
    problemWhen: true,
    severity: SeoIssueSeverity.MEDIUM,
    message: "Title terlalu panjang.",
    recommendation: "Pangkas title menjadi ≤ 60 karakter.",
  },
  {
    key: "no_image_alt",
    problemWhen: true,
    severity: SeoIssueSeverity.MEDIUM,
    message: "Ada gambar tanpa alt text.",
    recommendation: "Tambahkan alt text deskriptif (akses + SEO gambar).",
  },
  {
    key: "size_greater_than_3mb",
    problemWhen: true,
    severity: SeoIssueSeverity.MEDIUM,
    message: "Ukuran halaman lebih dari 3MB.",
    recommendation: "Kompres gambar & aset agar halaman lebih ringan.",
  },
  {
    key: "high_loading_time",
    problemWhen: true,
    severity: SeoIssueSeverity.MEDIUM,
    message: "Waktu muat halaman tinggi.",
    recommendation: "Optimalkan aset, caching, dan server response time.",
  },
  {
    key: "has_micromarkup_errors",
    problemWhen: true,
    severity: SeoIssueSeverity.MEDIUM,
    message: "Schema markup mengandung error.",
    recommendation: "Validasi structured data dengan Rich Results Test.",
  },
  {
    key: "low_content_rate",
    problemWhen: true,
    severity: SeoIssueSeverity.LOW,
    message: "Rasio konten teks terhadap kode rendah.",
    recommendation: "Tambah konten teks bermakna pada halaman.",
  },
  {
    key: "canonical",
    problemWhen: false,
    severity: SeoIssueSeverity.LOW,
    message: "Tidak ada tag canonical.",
    recommendation: "Tambahkan rel=canonical untuk mencegah konten duplikat.",
  },
  {
    key: "no_favicon",
    problemWhen: true,
    severity: SeoIssueSeverity.LOW,
    message: "Tidak ada favicon.",
    recommendation: "Tambahkan favicon untuk identitas brand di tab & SERP.",
  },
  {
    key: "no_content_encoding",
    problemWhen: true,
    severity: SeoIssueSeverity.LOW,
    message: "Tidak ada kompresi konten (gzip/brotli).",
    recommendation: "Aktifkan kompresi gzip/brotli di server.",
  },
];

/** Bobot penalti per severity untuk skor 0-100. */
const SEVERITY_PENALTY: Record<SeoIssueSeverity, number> = {
  CRITICAL: 20,
  HIGH: 12,
  MEDIUM: 6,
  LOW: 2,
  INFO: 0,
};

export function buildOnPageIssues(input: AuditInput): AuditIssue[] {
  const issues: AuditIssue[] = [];
  const flagged = new Set<string>();

  for (const rule of CHECK_RULES) {
    const value = input.checks[rule.key];
    if (typeof value === "boolean" && value === rule.problemWhen) {
      issues.push({
        type: rule.key,
        severity: rule.severity,
        message: rule.message,
        recommendation: rule.recommendation,
      });
      flagged.add(rule.key);
    }
  }

  // Schema markup absen (bila DataForSEO menandai has_micromarkup === false).
  if (input.hasSchema === false && !flagged.has("has_micromarkup")) {
    issues.push({
      type: "no_schema",
      severity: SeoIssueSeverity.LOW,
      message: "Belum ada schema markup (structured data).",
      recommendation:
        "Tambahkan JSON-LD (Product/Article/Organization) untuk rich results.",
    });
  }

  // Panjang title (hanya bila belum di-flag too_long oleh checks).
  if (input.title && !flagged.has("title_too_long") && !flagged.has("no_title")) {
    const len = input.title.length;
    if (len > 60) {
      issues.push({
        type: "title_length",
        severity: SeoIssueSeverity.MEDIUM,
        message: `Title terlalu panjang (${len} karakter).`,
        recommendation: "Pangkas title menjadi 50–60 karakter.",
      });
    } else if (len < 30) {
      issues.push({
        type: "title_length",
        severity: SeoIssueSeverity.LOW,
        message: `Title terlalu pendek (${len} karakter).`,
        recommendation: "Perpanjang title menjadi 50–60 karakter yang deskriptif.",
      });
    }
  }

  // Panjang description.
  if (input.description && !flagged.has("no_description")) {
    const len = input.description.length;
    if (len > 160) {
      issues.push({
        type: "description_length",
        severity: SeoIssueSeverity.LOW,
        message: `Meta description terlalu panjang (${len} karakter).`,
        recommendation: "Pangkas menjadi 120–160 karakter.",
      });
    } else if (len < 70) {
      issues.push({
        type: "description_length",
        severity: SeoIssueSeverity.LOW,
        message: `Meta description terlalu pendek (${len} karakter).`,
        recommendation: "Perpanjang menjadi 120–160 karakter.",
      });
    }
  }

  // Konten tipis.
  if (input.wordCount != null && input.wordCount < 300) {
    issues.push({
      type: "thin_content",
      severity: SeoIssueSeverity.MEDIUM,
      message: `Konten tipis (${input.wordCount} kata).`,
      recommendation: "Tambah konten bernilai minimal 300+ kata.",
    });
  }

  // Lebih dari satu H1.
  if (input.h1Count > 1) {
    issues.push({
      type: "multiple_h1",
      severity: SeoIssueSeverity.LOW,
      message: `Terdapat ${input.h1Count} tag H1 (idealnya satu).`,
      recommendation: "Gunakan satu H1 utama; sisanya jadikan H2/H3.",
    });
  }

  // Gambar tanpa alt (jumlah dari parsing HTML; bila DataForSEO sudah flag, lewati).
  if (
    input.imagesWithoutAlt != null &&
    input.imagesWithoutAlt > 0 &&
    !flagged.has("no_image_alt")
  ) {
    issues.push({
      type: "images_without_alt",
      severity: SeoIssueSeverity.MEDIUM,
      message: `${input.imagesWithoutAlt} gambar tanpa alt text.`,
      recommendation: "Tambahkan alt text deskriptif pada setiap gambar penting.",
    });
  }

  // Penggunaan keyword target.
  if (input.targetKeyword) {
    if (input.keywordInTitle === false) {
      issues.push({
        type: "keyword_not_in_title",
        severity: SeoIssueSeverity.MEDIUM,
        message: `Keyword "${input.targetKeyword}" tidak ada di title.`,
        recommendation: "Masukkan keyword utama ke title (idealnya di awal).",
      });
    }
    if (input.keywordInH1 === false) {
      issues.push({
        type: "keyword_not_in_h1",
        severity: SeoIssueSeverity.LOW,
        message: `Keyword "${input.targetKeyword}" tidak ada di H1.`,
        recommendation: "Selaraskan H1 dengan keyword utama.",
      });
    }
    if (input.keywordInDescription === false) {
      issues.push({
        type: "keyword_not_in_description",
        severity: SeoIssueSeverity.LOW,
        message: `Keyword "${input.targetKeyword}" tidak ada di meta description.`,
        recommendation: "Sertakan keyword di meta description secara natural.",
      });
    }
  }

  return issues;
}

/** Skor 0-100 dari daftar isu (penalti berbobot). Deterministik & dijelaskan. */
export function computeOnPageScore(issues: AuditIssue[]): number {
  const penalty = issues.reduce(
    (sum, issue) => sum + SEVERITY_PENALTY[issue.severity],
    0,
  );
  return Math.max(0, Math.min(100, 100 - penalty));
}

/** Urutan severity untuk sorting (CRITICAL dulu). */
export const SEVERITY_ORDER: Record<SeoIssueSeverity, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
  INFO: 4,
};

export function sortIssuesBySeverity<T extends { severity: SeoIssueSeverity }>(
  issues: T[],
): T[] {
  return [...issues].sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity],
  );
}
