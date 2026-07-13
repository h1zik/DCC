import { describe, expect, it } from "vitest";
import {
  classifyBucket,
  mergeGapRows,
  type GapSourceRow,
} from "@/lib/seo/keyword-gap/gap-logic";

describe("classifyBucket", () => {
  it("classifies missing / untapped for unranked target", () => {
    expect(classifyBucket(null, [3, 5], 2)).toBe("missing");
    expect(classifyBucket(null, [3, null], 2)).toBe("untapped");
    expect(classifyBucket(null, [3], 1)).toBe("missing");
  });

  it("classifies weak / strong / shared for ranked target", () => {
    expect(classifyBucket(10, [2, 4], 2)).toBe("weak");
    expect(classifyBucket(2, [5, 9], 2)).toBe("strong");
    expect(classifyBucket(5, [2, 9], 2)).toBe("shared");
    expect(classifyBucket(5, [null, null], 2)).toBe("strong");
  });
});

const rowsA: GapSourceRow[] = [
  {
    keyword: "serum niacinamide",
    searchVolume: 5000,
    difficulty: 40,
    targetPosition: 8,
    competitorPosition: 2,
  },
  {
    keyword: "toner exfoliating",
    searchVolume: 2000,
    difficulty: 30,
    targetPosition: null,
    competitorPosition: 4,
  },
];

const rowsB: GapSourceRow[] = [
  {
    keyword: "serum niacinamide",
    searchVolume: 5000,
    difficulty: 40,
    targetPosition: 8,
    competitorPosition: 12,
  },
  {
    keyword: "sunscreen gel",
    searchVolume: 8000,
    difficulty: 55,
    targetPosition: 3,
    competitorPosition: null,
  },
];

describe("mergeGapRows", () => {
  it("merges rows per keyword across competitors and classifies", () => {
    const { rows, summary, truncated } = mergeGapRows({
      "komp-a.com": rowsA,
      "komp-b.com": rowsB,
    });

    expect(truncated).toBe(false);
    expect(rows).toHaveLength(3);
    // Urut volume desc.
    expect(rows[0].keyword).toBe("sunscreen gel");

    const serum = rows.find((r) => r.keyword === "serum niacinamide")!;
    expect(serum.competitorPos).toEqual({ "komp-a.com": 2, "komp-b.com": 12 });
    expect(serum.bucket).toBe("shared"); // komp-a lebih baik, komp-b lebih buruk

    const toner = rows.find((r) => r.keyword === "toner exfoliating")!;
    expect(toner.bucket).toBe("untapped"); // hanya komp-a ranking, target tidak

    const sunscreen = rows.find((r) => r.keyword === "sunscreen gel")!;
    expect(sunscreen.bucket).toBe("strong");

    expect(summary.buckets.shared).toBe(1);
    expect(summary.buckets.untapped).toBe(1);
    expect(summary.buckets.strong).toBe(1);
    expect(summary.domainCounts.target).toBe(2);
    expect(summary.domainCounts["komp-a.com"]).toBe(2);
    expect(summary.totalKeywords).toBe(3);
  });

  it("caps rows and reports truncation", () => {
    const many: GapSourceRow[] = Array.from({ length: 20 }, (_, i) => ({
      keyword: `kw ${i}`,
      searchVolume: i,
      difficulty: null,
      targetPosition: null,
      competitorPosition: 1,
    }));
    const { rows, truncated, summary } = mergeGapRows(
      { "komp.com": many },
      { cap: 5 },
    );
    expect(rows).toHaveLength(5);
    expect(truncated).toBe(true);
    expect(summary.totalKeywords).toBe(20);
  });
});
