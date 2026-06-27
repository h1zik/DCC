import { describe, expect, it } from "vitest";
import { SeoKeywordIntent } from "@prisma/client";
import {
  rankByOpportunity,
  scoreKeywordOpportunity,
  type OpportunityInput,
} from "@/lib/seo/content/opportunity";

function kw(overrides: Partial<OpportunityInput> = {}): OpportunityInput {
  return {
    searchVolume: 1000,
    difficulty: 30,
    intent: SeoKeywordIntent.COMMERCIAL,
    monthlyTrend: null,
    ...overrides,
  };
}

describe("scoreKeywordOpportunity", () => {
  it("prefers winnable (low difficulty) over unwinnable at same volume", () => {
    const easy = scoreKeywordOpportunity(kw({ searchVolume: 10000, difficulty: 10 }));
    const hard = scoreKeywordOpportunity(kw({ searchVolume: 10000, difficulty: 90 }));
    expect(easy.score).toBeGreaterThan(hard.score);
  });

  it("does not let a huge-volume head term win when difficulty is high", () => {
    const headTerm = scoreKeywordOpportunity(
      kw({ searchVolume: 100000, difficulty: 95, intent: SeoKeywordIntent.INFORMATIONAL }),
    );
    const longTail = scoreKeywordOpportunity(
      kw({ searchVolume: 400, difficulty: 12, intent: SeoKeywordIntent.TRANSACTIONAL }),
    );
    expect(longTail.score).toBeGreaterThan(headTerm.score);
  });

  it("rewards upward trend over downward", () => {
    const up = scoreKeywordOpportunity(kw({ monthlyTrend: { direction: "up" } }));
    const down = scoreKeywordOpportunity(kw({ monthlyTrend: { direction: "down" } }));
    expect(up.score).toBeGreaterThan(down.score);
  });

  it("weights transactional/commercial intent above informational", () => {
    const txn = scoreKeywordOpportunity(kw({ intent: SeoKeywordIntent.TRANSACTIONAL }));
    const info = scoreKeywordOpportunity(kw({ intent: SeoKeywordIntent.INFORMATIONAL }));
    expect(txn.score).toBeGreaterThan(info.score);
  });

  it("handles null volume/difficulty without NaN and stays within 0-100", () => {
    const s = scoreKeywordOpportunity(
      kw({ searchVolume: null, difficulty: null, intent: SeoKeywordIntent.UNKNOWN }),
    );
    expect(Number.isFinite(s.score)).toBe(true);
    expect(s.score).toBeGreaterThanOrEqual(0);
    expect(s.score).toBeLessThanOrEqual(100);
  });
});

describe("rankByOpportunity", () => {
  it("sorts descending by score", () => {
    const ranked = rankByOpportunity([
      kw({ searchVolume: 10000, difficulty: 95 }),
      kw({ searchVolume: 800, difficulty: 10, intent: SeoKeywordIntent.TRANSACTIONAL }),
      kw({ searchVolume: 3000, difficulty: 40 }),
    ]);
    expect(ranked[0].opportunity.score).toBeGreaterThanOrEqual(
      ranked[1].opportunity.score,
    );
    expect(ranked[1].opportunity.score).toBeGreaterThanOrEqual(
      ranked[2].opportunity.score,
    );
  });
});
