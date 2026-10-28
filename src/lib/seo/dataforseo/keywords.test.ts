import { describe, expect, it } from "vitest";
import { SeoKeywordIntent } from "@prisma/client";
import {
  finalizeIdeasWithSeed,
  mapIntent,
  mergeIdeaPools,
  parseMonthlyTrend,
  sortIdeasByVolume,
  type SeoKeywordIdea,
} from "@/lib/seo/dataforseo/keywords";

function idea(
  keyword: string,
  searchVolume: number | null,
  source = "dataforseo_labs",
): SeoKeywordIdea {
  return {
    keyword,
    searchVolume,
    cpc: null,
    competition: null,
    difficulty: null,
    intent: SeoKeywordIntent.UNKNOWN,
    monthlyTrend: null,
    source,
  };
}

describe("mapIntent", () => {
  it("maps DataForSEO labels case-insensitively", () => {
    expect(mapIntent("Informational")).toBe(SeoKeywordIntent.INFORMATIONAL);
    expect(mapIntent("COMMERCIAL")).toBe(SeoKeywordIntent.COMMERCIAL);
    expect(mapIntent("transactional")).toBe(SeoKeywordIntent.TRANSACTIONAL);
    expect(mapIntent("navigational")).toBe(SeoKeywordIntent.NAVIGATIONAL);
  });

  it("falls back to UNKNOWN", () => {
    expect(mapIntent(null)).toBe(SeoKeywordIntent.UNKNOWN);
    expect(mapIntent(undefined)).toBe(SeoKeywordIntent.UNKNOWN);
    expect(mapIntent("something-else")).toBe(SeoKeywordIntent.UNKNOWN);
  });
});

describe("parseMonthlyTrend", () => {
  it("returns null without usable points", () => {
    expect(parseMonthlyTrend(null)).toBeNull();
    expect(parseMonthlyTrend([])).toBeNull();
    expect(parseMonthlyTrend([{ year: 2026, month: 1, search_volume: null }])).toBeNull();
  });

  it("marks short series as flat and sorts points chronologically", () => {
    const trend = parseMonthlyTrend([
      { year: 2026, month: 3, search_volume: 10 },
      { year: 2026, month: 1, search_volume: 5 },
    ]);
    expect(trend?.direction).toBe("flat");
    expect(trend?.points.map((p) => p.month)).toEqual([1, 3]);
  });

  it("detects up and down from last 3 vs prior 3 months", () => {
    const up = parseMonthlyTrend([
      { year: 2026, month: 1, search_volume: 100 },
      { year: 2026, month: 2, search_volume: 100 },
      { year: 2026, month: 3, search_volume: 100 },
      { year: 2026, month: 4, search_volume: 200 },
      { year: 2026, month: 5, search_volume: 200 },
      { year: 2026, month: 6, search_volume: 200 },
    ]);
    expect(up?.direction).toBe("up");

    const down = parseMonthlyTrend([
      { year: 2026, month: 1, search_volume: 200 },
      { year: 2026, month: 2, search_volume: 200 },
      { year: 2026, month: 3, search_volume: 200 },
      { year: 2026, month: 4, search_volume: 100 },
      { year: 2026, month: 5, search_volume: 100 },
      { year: 2026, month: 6, search_volume: 100 },
    ]);
    expect(down?.direction).toBe("down");
  });

  it("does not divide by zero when the prior window is all zero", () => {
    const trend = parseMonthlyTrend([
      { year: 2026, month: 1, search_volume: 0 },
      { year: 2026, month: 2, search_volume: 0 },
      { year: 2026, month: 3, search_volume: 0 },
      { year: 2026, month: 4, search_volume: 50 },
      { year: 2026, month: 5, search_volume: 50 },
      { year: 2026, month: 6, search_volume: 50 },
    ]);
    expect(trend?.direction).toBe("flat");
  });
});

describe("sortIdeasByVolume", () => {
  it("sorts descending with nulls last", () => {
    const sorted = sortIdeasByVolume([
      idea("a", null),
      idea("b", 10),
      idea("c", 500),
      idea("d", null),
    ]);
    expect(sorted.map((s) => s.keyword)).toEqual(["c", "b", "a", "d"]);
  });
});

describe("mergeIdeaPools", () => {
  const suggestions = Array.from({ length: 20 }, (_, i) =>
    idea(`sugg ${i}`, 1000 - i),
  );
  const related = Array.from({ length: 20 }, (_, i) =>
    idea(`rel ${i}`, 5000 - i, "dataforseo_labs_related"),
  );

  it("reserves ~30% of the slots for related keywords", () => {
    const merged = mergeIdeaPools(suggestions, related, 10);
    expect(merged).toHaveLength(10);
    const relatedCount = merged.filter((m) => m.source.endsWith("_related")).length;
    expect(relatedCount).toBe(3);
    expect(merged.filter((m) => m.source === "dataforseo_labs")).toHaveLength(7);
  });

  it("sorts the merged result by volume desc", () => {
    const merged = mergeIdeaPools(suggestions, related, 10);
    const volumes = merged.map((m) => m.searchVolume ?? -1);
    expect(volumes).toEqual([...volumes].sort((a, b) => b - a));
  });

  it("dedupes case-insensitively with suggestions winning", () => {
    const merged = mergeIdeaPools(
      [idea("Serum Wajah", 100)],
      [idea("serum wajah", 999, "dataforseo_labs_related"), idea("toner", 50, "r")],
      10,
    );
    expect(merged.map((m) => m.keyword)).toEqual(["Serum Wajah", "toner"]);
    expect(merged[0]?.source).toBe("dataforseo_labs");
  });

  it("lets suggestions fill the list when related is empty or fails", () => {
    const merged = mergeIdeaPools(suggestions, [], 10);
    expect(merged).toHaveLength(10);
    expect(merged.every((m) => m.source === "dataforseo_labs")).toBe(true);
  });

  it("lets related fill the list when suggestions are short", () => {
    const merged = mergeIdeaPools(suggestions.slice(0, 2), related, 10);
    expect(merged).toHaveLength(10);
    expect(merged.filter((m) => m.source === "dataforseo_labs")).toHaveLength(2);
  });

  it("returns an empty list for a zero limit", () => {
    expect(mergeIdeaPools(suggestions, related, 0)).toEqual([]);
  });
});

describe("finalizeIdeasWithSeed", () => {
  it("prepends a seed stub and keeps the total exactly at the limit", () => {
    const list = Array.from({ length: 5 }, (_, i) => idea(`kw ${i}`, 100 - i));
    const { ideas, seedInserted } = finalizeIdeasWithSeed("serum", list, 5);
    expect(seedInserted).toBe(true);
    expect(ideas).toHaveLength(5);
    expect(ideas[0]).toMatchObject({ keyword: "serum", source: "seed", searchVolume: null });
    expect(ideas.map((i) => i.keyword)).not.toContain("kw 4");
  });

  it("moves an existing seed to the front instead of duplicating it", () => {
    const list = [idea("kw a", 500), idea("Serum", 20), idea("kw b", 5)];
    const { ideas, seedInserted } = finalizeIdeasWithSeed("serum", list, 3);
    expect(seedInserted).toBe(false);
    expect(ideas).toHaveLength(3);
    expect(ideas[0]?.keyword).toBe("Serum");
    expect(ideas.filter((i) => i.keyword.toLowerCase() === "serum")).toHaveLength(1);
  });
});
