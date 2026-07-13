import { describe, expect, it } from "vitest";
import { SeoIssueSeverity } from "@prisma/client";
import { computeHealthScore } from "@/lib/seo/crawler/health-score";

describe("computeHealthScore", () => {
  it("is 100 for no issues", () => {
    expect(computeHealthScore([], 100)).toBe(100);
  });

  it("penalizes by severity, normalized per page", () => {
    const few = computeHealthScore(
      [{ severity: SeoIssueSeverity.HIGH, count: 10 }],
      100,
    );
    expect(few).toBe(95); // 50 penalti / 100 halaman * 10 = 5

    const many = computeHealthScore(
      [{ severity: SeoIssueSeverity.CRITICAL, count: 100 }],
      100,
    );
    expect(many).toBe(0);
  });

  it("small sites are judged proportionally", () => {
    const small = computeHealthScore(
      [{ severity: SeoIssueSeverity.MEDIUM, count: 2 }],
      10,
    );
    expect(small).toBe(96); // 4/10*10 = 4
  });

  it("clamps to 0..100", () => {
    expect(
      computeHealthScore(
        [{ severity: SeoIssueSeverity.CRITICAL, count: 10000 }],
        1,
      ),
    ).toBe(0);
  });
});
