import { describe, expect, it } from "vitest";
import { computeBacklinkGap } from "@/lib/seo/backlinks/gap";

describe("computeBacklinkGap", () => {
  it("returns competitor domains the target does not have", () => {
    const target = [{ domain: "blog-a.com" }, { domain: "www.blog-b.com" }];
    const competitor = [
      { domain: "blog-a.com", rank: 50, backlinks: 10 },
      { domain: "blog-c.com", rank: 80, backlinks: 5 },
      { domain: "blog-d.com", rank: 30, backlinks: 2 },
    ];
    const gap = computeBacklinkGap(target, competitor);
    const domains = gap.map((g) => g.domain);
    expect(domains).toContain("blog-c.com");
    expect(domains).toContain("blog-d.com");
    expect(domains).not.toContain("blog-a.com");
  });

  it("normalizes www when comparing", () => {
    const target = [{ domain: "www.blog-b.com" }];
    const competitor = [{ domain: "blog-b.com", rank: 10, backlinks: 1 }];
    expect(computeBacklinkGap(target, competitor)).toHaveLength(0);
  });

  it("dedupes competitor domains and sorts by rank desc", () => {
    const gap = computeBacklinkGap(
      [],
      [
        { domain: "low.com", rank: 10, backlinks: 1 },
        { domain: "high.com", rank: 90, backlinks: 9 },
        { domain: "high.com", rank: 90, backlinks: 9 },
      ],
    );
    expect(gap).toHaveLength(2);
    expect(gap[0].domain).toBe("high.com");
  });
});
