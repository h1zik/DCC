import { SeoIssueSeverity } from "@prisma/client";
import { sortIssuesBySeverity } from "@/lib/seo/onpage-audit/audit-rules";
import type { CrawlSummary } from "@/lib/seo/dataforseo/onpage";

/**
 * Bangun daftar isu teknis terurut prioritas dari ringkasan crawl DataForSEO.
 * Pure (tanpa server) agar mudah di-test.
 */

export type CrawlIssueInput = {
  type: string;
  severity: SeoIssueSeverity;
  count: number;
  message: string;
};

type CheckRule = {
  key: string;
  severity: SeoIssueSeverity;
  message: string;
};

/** Aturan dari `page_metrics.checks` (nilai = jumlah halaman dengan isu). */
const CHECK_RULES: CheckRule[] = [
  { key: "is_5xx_code", severity: SeoIssueSeverity.CRITICAL, message: "Halaman mengembalikan status 5xx." },
  { key: "is_4xx_code", severity: SeoIssueSeverity.HIGH, message: "Halaman mengembalikan status 4xx." },
  { key: "is_broken", severity: SeoIssueSeverity.HIGH, message: "Halaman broken / tidak dapat diakses." },
  { key: "no_title", severity: SeoIssueSeverity.HIGH, message: "Halaman tanpa title tag." },
  { key: "recursive_canonical", severity: SeoIssueSeverity.MEDIUM, message: "Canonical rekursif/berantai." },
  { key: "no_description", severity: SeoIssueSeverity.MEDIUM, message: "Halaman tanpa meta description." },
  { key: "no_h1_tag", severity: SeoIssueSeverity.MEDIUM, message: "Halaman tanpa heading H1." },
  { key: "high_loading_time", severity: SeoIssueSeverity.MEDIUM, message: "Waktu muat halaman tinggi." },
  { key: "title_too_long", severity: SeoIssueSeverity.LOW, message: "Title terlalu panjang." },
  { key: "no_image_alt", severity: SeoIssueSeverity.LOW, message: "Gambar tanpa alt text." },
  { key: "low_content_rate", severity: SeoIssueSeverity.LOW, message: "Rasio konten teks rendah (konten tipis)." },
  { key: "large_page_size", severity: SeoIssueSeverity.LOW, message: "Halaman lebih dari 3MB." },
  { key: "has_render_blocking_resources", severity: SeoIssueSeverity.LOW, message: "Ada resource yang memblok render." },
  { key: "is_orphan_page", severity: SeoIssueSeverity.LOW, message: "Halaman orphan (tanpa internal link masuk)." },
  { key: "no_content_encoding", severity: SeoIssueSeverity.LOW, message: "Halaman tanpa kompresi konten." },
];

export function buildCrawlIssues(summary: CrawlSummary): CrawlIssueInput[] {
  const issues: CrawlIssueInput[] = [];
  const push = (
    type: string,
    severity: SeoIssueSeverity,
    count: number | null,
    message: string,
  ) => {
    if (count != null && count > 0) issues.push({ type, severity, count, message });
  };

  const pm = summary.pageMetrics;
  if (pm) {
    push("broken_links", SeoIssueSeverity.HIGH, pm.brokenLinks, "Broken link (tautan rusak).");
    push("broken_resources", SeoIssueSeverity.MEDIUM, pm.brokenResources, "Resource rusak (gambar/script/CSS).");
    push("redirect_loop", SeoIssueSeverity.HIGH, pm.redirectLoop, "Redirect loop terdeteksi.");
    push("duplicate_title", SeoIssueSeverity.MEDIUM, pm.duplicateTitle, "Title duplikat antar halaman.");
    push("duplicate_description", SeoIssueSeverity.MEDIUM, pm.duplicateDescription, "Meta description duplikat.");
    push("duplicate_content", SeoIssueSeverity.MEDIUM, pm.duplicateContent, "Konten duplikat antar halaman.");
    push("non_indexable", SeoIssueSeverity.LOW, pm.nonIndexable, "Halaman non-indexable.");

    for (const rule of CHECK_RULES) {
      const count = pm.checks[rule.key];
      if (typeof count === "number" && count > 0) {
        push(rule.key, rule.severity, count, rule.message);
      }
    }
  }

  // Isu level-domain (sitemap / robots / ssl).
  const dc = summary.domainChecks ?? {};
  if (dc.sitemap === false) {
    issues.push({
      type: "no_sitemap",
      severity: SeoIssueSeverity.MEDIUM,
      count: 1,
      message: "Tidak ditemukan sitemap.xml.",
    });
  }
  if (dc.robots_txt === false) {
    issues.push({
      type: "no_robots",
      severity: SeoIssueSeverity.LOW,
      count: 1,
      message: "Tidak ditemukan robots.txt.",
    });
  }
  if (dc.ssl === false) {
    issues.push({
      type: "no_ssl",
      severity: SeoIssueSeverity.HIGH,
      count: 1,
      message: "Sertifikat SSL tidak valid / situs tidak HTTPS.",
    });
  }

  return sortIssuesBySeverity(issues);
}
