import { describe, expect, it } from "vitest";
import { SeoIssueSeverity } from "@prisma/client";
import {
  buildOnPageIssues,
  computeOnPageScore,
  sortIssuesBySeverity,
  type AuditInput,
} from "@/lib/seo/onpage-audit/audit-rules";

function baseInput(overrides: Partial<AuditInput> = {}): AuditInput {
  return {
    onpageScore: null,
    title: "Serum Vitamin C Terbaik untuk Kulit Cerah",
    description:
      "Serum vitamin C untuk mencerahkan kulit, mengurangi noda, dan melembapkan. Cocok untuk semua jenis kulit.",
    h1Count: 1,
    wordCount: 800,
    hasSchema: true,
    checks: {},
    targetKeyword: null,
    keywordInTitle: null,
    keywordInDescription: null,
    keywordInH1: null,
    imagesWithoutAlt: null,
    ...overrides,
  };
}

describe("buildOnPageIssues", () => {
  it("flags critical/high check-based issues", () => {
    const issues = buildOnPageIssues(
      baseInput({ checks: { no_title: true, no_h1_tag: true, https: false } }),
    );
    const types = issues.map((i) => i.type);
    expect(types).toContain("no_title");
    expect(types).toContain("no_h1_tag");
    expect(types).toContain("https");
    const noTitle = issues.find((i) => i.type === "no_title");
    expect(noTitle?.severity).toBe(SeoIssueSeverity.CRITICAL);
  });

  it("flags thin content and long title from signals", () => {
    const issues = buildOnPageIssues(
      baseInput({ wordCount: 120, title: "x".repeat(80) }),
    );
    expect(issues.map((i) => i.type)).toContain("thin_content");
    expect(issues.map((i) => i.type)).toContain("title_length");
  });

  it("flags missing keyword in title when target keyword set", () => {
    const issues = buildOnPageIssues(
      baseInput({ targetKeyword: "moisturizer", keywordInTitle: false }),
    );
    expect(issues.map((i) => i.type)).toContain("keyword_not_in_title");
  });

  it("flags absent schema markup", () => {
    const issues = buildOnPageIssues(baseInput({ hasSchema: false }));
    expect(issues.map((i) => i.type)).toContain("no_schema");
  });

  it("returns no major issues for a healthy page", () => {
    const issues = buildOnPageIssues(baseInput());
    expect(issues).toHaveLength(0);
  });
});

describe("computeOnPageScore", () => {
  it("returns 100 with no issues", () => {
    expect(computeOnPageScore([])).toBe(100);
  });

  it("subtracts weighted penalties (critical 20 + high 12)", () => {
    const issues = [
      { type: "a", severity: SeoIssueSeverity.CRITICAL, message: "", recommendation: "" },
      { type: "b", severity: SeoIssueSeverity.HIGH, message: "", recommendation: "" },
    ];
    expect(computeOnPageScore(issues)).toBe(68);
  });

  it("never drops below zero", () => {
    const issues = Array.from({ length: 10 }, () => ({
      type: "x",
      severity: SeoIssueSeverity.CRITICAL,
      message: "",
      recommendation: "",
    }));
    expect(computeOnPageScore(issues)).toBe(0);
  });
});

describe("sortIssuesBySeverity", () => {
  it("orders CRITICAL before LOW", () => {
    const sorted = sortIssuesBySeverity([
      { type: "low", severity: SeoIssueSeverity.LOW, message: "", recommendation: "" },
      { type: "crit", severity: SeoIssueSeverity.CRITICAL, message: "", recommendation: "" },
    ]);
    expect(sorted[0].type).toBe("crit");
  });
});
