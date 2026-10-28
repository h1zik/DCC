import { describe, expect, it } from "vitest";
import { SeoIssueSeverity } from "@prisma/client";
import { buildCrawlIssues } from "@/lib/seo/crawler/crawl-rules";
import type { CrawlSummary } from "@/lib/seo/dataforseo/onpage";

function summary(overrides: Partial<CrawlSummary> = {}): CrawlSummary {
  return {
    crawlProgress: "finished",
    pagesCrawled: 50,
    pagesInQueue: 0,
    maxCrawlPages: 100,
    pageMetrics: {
      checks: {},
      brokenLinks: null,
      brokenResources: null,
      duplicateTitle: null,
      duplicateDescription: null,
      duplicateContent: null,
      redirectLoop: null,
      nonIndexable: null,
      linksExternal: null,
      linksInternal: null,
      onpageScore: 80,
    },
    domainInfo: null,
    domainChecks: {},
    ...overrides,
  };
}

describe("buildCrawlIssues", () => {
  it("builds issues from numeric metrics", () => {
    const issues = buildCrawlIssues(
      summary({
        pageMetrics: {
          ...summary().pageMetrics!,
          brokenLinks: 5,
          duplicateTitle: 3,
        },
      }),
    );
    const byType = Object.fromEntries(issues.map((i) => [i.type, i]));
    expect(byType.broken_links.count).toBe(5);
    // Tautan ke target yang sama = satu masalah → MEDIUM, bukan HIGH.
    expect(byType.broken_links.severity).toBe(SeoIssueSeverity.MEDIUM);
    expect(byType.duplicate_title.count).toBe(3);
  });

  it("does not double-count is_broken pages already covered by 4xx/5xx", () => {
    const issues = buildCrawlIssues(
      summary({
        pageMetrics: {
          ...summary().pageMetrics!,
          checks: { is_broken: 5, is_4xx_code: 3, is_5xx_code: 2 },
        },
      }),
    );
    const types = issues.map((i) => i.type);
    expect(types).toContain("is_4xx_code");
    expect(types).toContain("is_5xx_code");
    expect(types).not.toContain("is_broken");
  });

  it("keeps the remainder of is_broken (timeouts) beyond 4xx/5xx", () => {
    const issues = buildCrawlIssues(
      summary({
        pageMetrics: {
          ...summary().pageMetrics!,
          checks: { is_broken: 6, is_4xx_code: 4 },
        },
      }),
    );
    const broken = issues.find((i) => i.type === "is_broken");
    expect(broken?.count).toBe(2);
    expect(broken?.severity).toBe(SeoIssueSeverity.HIGH);
  });

  it("builds issues from page_metrics.checks counts", () => {
    const issues = buildCrawlIssues(
      summary({
        pageMetrics: {
          ...summary().pageMetrics!,
          checks: { is_5xx_code: 2, no_title: 4, title_too_long: 7 },
        },
      }),
    );
    const types = issues.map((i) => i.type);
    expect(types).toContain("is_5xx_code");
    expect(types).toContain("no_title");
    expect(types).toContain("title_too_long");
  });

  it("flags missing sitemap/robots/ssl from domain checks", () => {
    const issues = buildCrawlIssues(
      summary({ domainChecks: { sitemap: false, robots_txt: false, ssl: false } }),
    );
    const types = issues.map((i) => i.type);
    expect(types).toContain("no_sitemap");
    expect(types).toContain("no_robots");
    expect(types).toContain("no_ssl");
  });

  it("ignores zero/absent counts and sorts by severity", () => {
    const issues = buildCrawlIssues(
      summary({
        pageMetrics: {
          ...summary().pageMetrics!,
          brokenLinks: 0,
          checks: { is_5xx_code: 1, no_image_alt: 9 },
        },
      }),
    );
    expect(issues.map((i) => i.type)).not.toContain("broken_links");
    // CRITICAL (5xx) harus sebelum LOW (no_image_alt)
    expect(issues[0].type).toBe("is_5xx_code");
  });

  it("returns empty when no metrics and clean domain", () => {
    expect(buildCrawlIssues(summary())).toHaveLength(0);
  });
});
