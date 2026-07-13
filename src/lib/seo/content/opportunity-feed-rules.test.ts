import { describe, expect, it } from "vitest";
import {
  SeoKeywordIntent,
  SeoOpportunityStage,
  SeoOpportunityType,
} from "@prisma/client";
import {
  classifyTrackedKeyword,
  deriveStage,
  mergeCandidates,
  scoreCandidate,
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
