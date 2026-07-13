import { describe, expect, it } from "vitest";
import {
  classifyBucket,
  classifyBuckets,
  mergeGapRows,
  type GapDomainRow,
} from "@/lib/seo/keyword-gap/gap-logic";

describe("classifyBucket", () => {
  it("separates missing from untapped for an unranked target", () => {
    expect(classifyBucket(null, [3, 5, 8], 3)).toBe("missing");
    expect(classifyBucket(null, [3, 5, null], 3)).toBe("untapped");
    expect(classifyBucket(null, [3, null, null], 3)).toBe("untapped");
    expect(classifyBucket(null, [3], 1)).toBe("missing");
  });

  it("classifies unique, weak, strong, and shared rankings", () => {
    expect(classifyBucket(5, [null, null], 2)).toBe("unique");
    expect(classifyBucket(10, [2, 4], 2)).toBe("weak");
    expect(classifyBucket(2, [5, 9], 2)).toBe("strong");
    expect(classifyBucket(2, [5, null], 2)).toBe("strong");
    expect(classifyBucket(5, [2, 9], 2)).toBe("shared");
    expect(classifyBucket(5, [2, null], 2)).toBe("mixed");
  });

  it("keeps overlapping Semrush-style categories", () => {
    expect(classifyBuckets(10, [2, 4], 2)).toEqual(["weak", "shared"]);
    expect(classifyBuckets(null, [3, 5], 2)).toEqual([
      "missing",
      "untapped",
    ]);
  });
});

const targetRows: GapDomainRow[] = [
  {
    keyword: "serum niacinamide",
    searchVolume: 5000,
    difficulty: 40,
    position: 8,
  },
  {
    keyword: "sunscreen gel",
    searchVolume: 8000,
    difficulty: 55,
    position: 3,
  },
];

const rowsA: GapDomainRow[] = [
  {
    keyword: "serum niacinamide",
    searchVolume: 5000,
    difficulty: 40,
    position: 2,
  },
  {
    keyword: "toner exfoliating",
    searchVolume: 2000,
    difficulty: 30,
    position: 4,
  },
];

const rowsB: GapDomainRow[] = [
  {
    keyword: "serum niacinamide",
    searchVolume: 5000,
    difficulty: 40,
    position: 12,
  },
];

describe("mergeGapRows", () => {
  it("merges a true per-domain union and classifies each keyword", () => {
    const { rows, summary, truncated } = mergeGapRows("brand.com", {
      "brand.com": targetRows,
      "komp-a.com": rowsA,
      "komp-b.com": rowsB,
    });

    expect(truncated).toBe(false);
    expect(rows).toHaveLength(3);
    expect(rows[0].keyword).toBe("sunscreen gel");

    const serum = rows.find((row) => row.keyword === "serum niacinamide")!;
    expect(serum.targetPos).toBe(8);
    expect(serum.competitorPos).toEqual({
      "komp-a.com": 2,
      "komp-b.com": 12,
    });
    expect(serum.bucket).toBe("shared");
    expect(serum.buckets).toEqual(["shared"]);

    const toner = rows.find((row) => row.keyword === "toner exfoliating")!;
    expect(toner.bucket).toBe("untapped");
    expect(toner.buckets).toEqual(["untapped"]);

    const sunscreen = rows.find((row) => row.keyword === "sunscreen gel")!;
    expect(sunscreen.bucket).toBe("unique");
    expect(sunscreen.buckets).toEqual(["unique"]);

    expect(summary.buckets.shared).toBe(1);
    expect(summary.buckets.untapped).toBe(1);
    expect(summary.buckets.unique).toBe(1);
    expect(summary.domainCounts.target).toBe(2);
    expect(summary.domainCounts["komp-a.com"]).toBe(2);
    expect(summary.totalKeywords).toBe(3);
    expect(summary.version).toBe(2);
  });

  it("preserves coverage metadata and reports row truncation", () => {
    const many: GapDomainRow[] = Array.from({ length: 20 }, (_, index) => ({
      keyword: `kw ${index}`,
      searchVolume: index,
      difficulty: null,
      position: 1,
    }));
    const coverage = {
      fetchedByDomain: { "brand.com": 20, "komp.com": 0 },
      totalByDomain: { "brand.com": 25, "komp.com": 0 },
      truncatedDomains: ["brand.com"],
      perDomainLimit: 20,
    };
    const { rows, truncated, summary } = mergeGapRows(
      "brand.com",
      { "brand.com": many, "komp.com": [] },
      { cap: 5, coverage },
    );
    expect(rows).toHaveLength(5);
    expect(truncated).toBe(true);
    expect(summary.totalKeywords).toBe(20);
    expect(summary.coverage).toEqual(coverage);
  });
});
