import { describe, expect, it } from "vitest";
import { diffCrawlIssues, type DiffableIssue } from "@/lib/seo/crawler/crawl-diff";

const issue = (over: Partial<DiffableIssue>): DiffableIssue => ({
  type: "no_title",
  url: "https://a.com/x",
  severity: "HIGH",
  message: "Halaman tanpa title.",
  count: 1,
  ...over,
});

describe("diffCrawlIssues", () => {
  it("detects new, fixed, persisting", () => {
    const prev = [
      issue({}),
      issue({ type: "no_h1_tag", url: "https://a.com/y" }),
    ];
    const curr = [
      issue({}),
      issue({ type: "is_4xx_code", url: "https://a.com/z", severity: "HIGH" }),
    ];
    const diff = diffCrawlIssues(prev, curr);
    expect(diff.new).toBe(1);
    expect(diff.newIssues[0].type).toBe("is_4xx_code");
    expect(diff.fixed).toBe(1);
    expect(diff.fixedIssues[0].type).toBe("no_h1_tag");
    expect(diff.persisting).toBe(1);
  });

  it("treats worsening aggregate counts as new", () => {
    const prev = [issue({ url: null, type: "duplicate_title", count: 3 })];
    const curr = [issue({ url: null, type: "duplicate_title", count: 7 })];
    const diff = diffCrawlIssues(prev, curr);
    expect(diff.new).toBe(1);
    expect(diff.newIssues[0].message).toContain("3 → 7");
    expect(diff.fixed).toBe(0);
  });

  it("stable aggregate counts persist", () => {
    const prev = [issue({ url: null, type: "duplicate_title", count: 3 })];
    const curr = [issue({ url: null, type: "duplicate_title", count: 3 })];
    const diff = diffCrawlIssues(prev, curr);
    expect(diff.persisting).toBe(1);
    expect(diff.new).toBe(0);
  });
});
