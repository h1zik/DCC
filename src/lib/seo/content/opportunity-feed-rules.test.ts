import { describe, expect, it } from "vitest";
import {
  SeoKeywordIntent,
  SeoOpportunityStage,
  SeoOpportunityType,
} from "@prisma/client";
import {
  classifyTrackedKeyword,
  deriveStage,
  excludeTopRanking,
  isTopRanking,
  mergeCandidates,
  normalizeOpportunityKeyword,
  scoreCandidate,
  selectPruneIds,
  type OpportunityCandidate,
} from "@/lib/seo/content/opportunity-feed-rules";

describe("classifyTrackedKeyword", () => {
  it("marks position 5-20 as OPTIMIZE_EXISTING", () => {
    expect(
      classifyTrackedKeyword({
        keyword: "x",
        lastPosition: 7,
        lastFoundUrl: "https://a.com/x",
        inKeywordProject: false,
      }),
    ).toBe(SeoOpportunityType.OPTIMIZE_EXISTING);
  });

  it("marks unranked researched keywords as NEW_ARTICLE", () => {
    expect(
      classifyTrackedKeyword({
        keyword: "x",
        lastPosition: null,
        lastFoundUrl: null,
        inKeywordProject: true,
      }),
    ).toBe(SeoOpportunityType.NEW_ARTICLE);
  });

  it("marks position 21-30 as OPTIMIZE_EXISTING (near striking distance)", () => {
    expect(
      classifyTrackedKeyword({
        keyword: "x",
        lastPosition: 25,
        lastFoundUrl: "https://a.com/x",
        inKeywordProject: true,
      }),
    ).toBe(SeoOpportunityType.OPTIMIZE_EXISTING);
    expect(
      classifyTrackedKeyword({
        keyword: "x",
        lastPosition: 31,
        lastFoundUrl: "https://a.com/x",
        inKeywordProject: true,
      }),
    ).toBe(SeoOpportunityType.NEW_ARTICLE);
  });

  it("ignores top positions and unresearched unranked keywords", () => {
    expect(
      classifyTrackedKeyword({
        keyword: "x",
        lastPosition: 2,
        lastFoundUrl: "https://a.com/x",
        inKeywordProject: true,
      }),
    ).toBeNull();
    expect(
      classifyTrackedKeyword({
        keyword: "x",
        lastPosition: null,
        lastFoundUrl: null,
        inKeywordProject: false,
      }),
    ).toBeNull();
  });
});

describe("scoreCandidate", () => {
  it("boosts OPTIMIZE_EXISTING (striking distance)", () => {
    const input = {
      searchVolume: 1000,
      difficulty: 40,
      intent: SeoKeywordIntent.COMMERCIAL,
    };
    const optimize = scoreCandidate(input, SeoOpportunityType.OPTIMIZE_EXISTING);
    const fresh = scoreCandidate(input, SeoOpportunityType.NEW_ARTICLE);
    expect(optimize).toBeGreaterThan(fresh);
    expect(optimize).toBeLessThanOrEqual(100);
  });

  it("scores position 21-30 lower than striking distance", () => {
    const input = {
      searchVolume: 1000,
      difficulty: 40,
      intent: SeoKeywordIntent.COMMERCIAL,
    };
    const striking = scoreCandidate(input, SeoOpportunityType.OPTIMIZE_EXISTING, 10);
    const near = scoreCandidate(input, SeoOpportunityType.OPTIMIZE_EXISTING, 25);
    expect(near).toBeLessThan(striking);
    expect(near).toBe(scoreCandidate(input, SeoOpportunityType.NEW_ARTICLE));
  });
});

describe("top ranking exclusion", () => {
  const cand = (keyword: string): OpportunityCandidate => ({
    keyword,
    type: SeoOpportunityType.NEW_ARTICLE,
    searchVolume: null,
    difficulty: null,
    intent: SeoKeywordIntent.UNKNOWN,
    opportunityScore: 50,
    currentPosition: null,
    targetUrl: null,
    source: "keyword_project",
    sourceRefId: null,
  });

  it("detects positions 1-4", () => {
    expect(isTopRanking(1)).toBe(true);
    expect(isTopRanking(4)).toBe(true);
    expect(isTopRanking(5)).toBe(false);
    expect(isTopRanking(null)).toBe(false);
  });

  it("drops project candidates already ranking top 4 (case-insensitive)", () => {
    const out = excludeTopRanking(
      [cand("Serum Niacinamide"), cand("toner exfoliating")],
      new Set(["serum niacinamide"]),
    );
    expect(out.map((c) => c.keyword)).toEqual(["toner exfoliating"]);
  });
});

describe("normalizeOpportunityKeyword", () => {
  it("lowercases, trims and collapses whitespace", () => {
    expect(normalizeOpportunityKeyword("  Serum   Niacinamide ")).toBe(
      "serum niacinamide",
    );
  });
});

describe("selectPruneIds", () => {
  const rows = [
    { id: "a", keyword: "serum niacinamide", source: "keyword_project" },
    { id: "b", keyword: "Toner Exfoliating", source: "rank_tracker" },
    { id: "c", keyword: "parfum gen z", source: "topic_run" },
    { id: "d", keyword: "sunscreen spf 50", source: "gsc_decay" },
    { id: "e", keyword: "cushion matte", source: "keyword_project" },
  ];

  it("only prunes engine-sourced rows missing from the refreshed set", () => {
    const keep = new Set(["serum niacinamide"]);
    expect(selectPruneIds(rows, keep)).toEqual(["b", "e"]);
  });

  it("matches keep set case-insensitively and never touches manual rows", () => {
    const keep = new Set(["toner exfoliating", "cushion matte"]);
    expect(selectPruneIds(rows, keep)).toEqual(["a"]);
    expect(selectPruneIds(rows, new Set())).not.toContain("c");
    expect(selectPruneIds(rows, new Set())).not.toContain("d");
  });
});

describe("deriveStage", () => {
  const base = { hasBrief: false, hasDraft: false, publishedUrl: null };

  it("progresses by relations", () => {
    expect(deriveStage({ ...base, current: SeoOpportunityStage.IDEA })).toBe(
      SeoOpportunityStage.IDEA,
    );
    expect(
      deriveStage({ ...base, current: SeoOpportunityStage.IDEA, hasBrief: true }),
    ).toBe(SeoOpportunityStage.BRIEFED);
    expect(
      deriveStage({
        ...base,
        current: SeoOpportunityStage.BRIEFED,
        hasBrief: true,
        hasDraft: true,
      }),
    ).toBe(SeoOpportunityStage.DRAFTED);
    expect(
      deriveStage({
        ...base,
        current: SeoOpportunityStage.DRAFTED,
        publishedUrl: "https://a.com/x",
      }),
    ).toBe(SeoOpportunityStage.PUBLISHED);
  });

  it("never downgrades and keeps DISMISSED", () => {
    expect(
      deriveStage({ ...base, current: SeoOpportunityStage.DRAFTED }),
    ).toBe(SeoOpportunityStage.DRAFTED);
    expect(
      deriveStage({
        ...base,
        current: SeoOpportunityStage.DISMISSED,
        hasBrief: true,
      }),
    ).toBe(SeoOpportunityStage.DISMISSED);
  });
});

describe("mergeCandidates", () => {
  const cand = (over: Partial<OpportunityCandidate>): OpportunityCandidate => ({
    keyword: "serum niacinamide",
    type: SeoOpportunityType.NEW_ARTICLE,
    searchVolume: null,
    difficulty: null,
    intent: SeoKeywordIntent.UNKNOWN,
    opportunityScore: 50,
    currentPosition: null,
    targetUrl: null,
    source: "keyword_project",
    sourceRefId: null,
    ...over,
  });

  it("prefers OPTIMIZE_EXISTING and merges data", () => {
    const merged = mergeCandidates([
      cand({ searchVolume: 900, opportunityScore: 80 }),
      cand({
        type: SeoOpportunityType.OPTIMIZE_EXISTING,
        opportunityScore: 60,
        currentPosition: 8,
        source: "rank_tracker",
      }),
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0].type).toBe(SeoOpportunityType.OPTIMIZE_EXISTING);
    expect(merged[0].searchVolume).toBe(900);
  });

  it("sorts by score desc", () => {
    const merged = mergeCandidates([
      cand({ keyword: "a", opportunityScore: 10 }),
      cand({ keyword: "b", opportunityScore: 90 }),
    ]);
    expect(merged.map((m) => m.keyword)).toEqual(["b", "a"]);
  });
});
