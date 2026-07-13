import { SeoIssueSeverity } from "@prisma/client";

/**
 * Skor kesehatan situs 0–100 dari daftar isu crawl, berbobot severity dan
 * dinormalisasi per halaman ter-crawl. Pure agar mudah di-test.
 */

const SEVERITY_WEIGHT: Record<SeoIssueSeverity, number> = {
  CRITICAL: 15,
  HIGH: 5,
  MEDIUM: 2,
  LOW: 0.5,
  INFO: 0,
};

export function computeHealthScore(
  issues: { severity: SeoIssueSeverity; count: number }[],
  pagesCrawled: number,
): number {
  const pages = Math.max(1, pagesCrawled);
  let penalty = 0;
  for (const issue of issues) {
    penalty += (SEVERITY_WEIGHT[issue.severity] ?? 0) * Math.max(1, issue.count);
  }
  const perPage = penalty / pages;
  return Math.max(0, Math.min(100, Math.round(100 - perPage * 10)));
}
