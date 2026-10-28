import { describe, expect, it } from "vitest";
import {
  describeRankChange,
  displayRankChangeKind,
  hasRankHistory,
  isSignificantRankChange,
  rankChangeKind,
} from "@/lib/seo/rank-tracker/rank-change";

describe("rankChangeKind", () => {
  it("classifies entering and dropping out of top 100", () => {
    expect(rankChangeKind(null, 12)).toBe("entered");
    expect(rankChangeKind(8, null)).toBe("dropped");
  });

  it("classifies up (smaller position) and down", () => {
    expect(rankChangeKind(10, 4)).toBe("up");
    expect(rankChangeKind(4, 10)).toBe("down");
    expect(rankChangeKind(5, 5)).toBe("same");
    expect(rankChangeKind(null, null)).toBe("same");
  });
});

describe("isSignificantRankChange", () => {
  it("treats enter/exit top 100 as significant", () => {
    expect(isSignificantRankChange(null, 50)).toBe(true);
    expect(isSignificantRankChange(50, null)).toBe(true);
  });

  it("is significant when crossing the top-10 boundary", () => {
    expect(isSignificantRankChange(11, 9)).toBe(true);
    expect(isSignificantRankChange(9, 11)).toBe(true);
  });

  it("is significant when shifting at least 3 positions", () => {
    expect(isSignificantRankChange(20, 23)).toBe(true);
    expect(isSignificantRankChange(20, 22)).toBe(false);
  });

  it("is not significant for no change", () => {
    expect(isSignificantRankChange(5, 5)).toBe(false);
    expect(isSignificantRankChange(null, null)).toBe(false);
  });
});

describe("describeRankChange", () => {
  it("describes an upward move", () => {
    expect(describeRankChange("serum vitamin c", 10, 4)).toContain("naik");
    expect(describeRankChange("serum vitamin c", 10, 4)).toContain("#4");
  });

  it("describes dropping out of the top 100", () => {
    expect(describeRankChange("toner", 8, null)).toContain("keluar");
  });
});

describe("hasRankHistory / displayRankChangeKind", () => {
  it("treats the very first check as having no comparable history", () => {
    expect(hasRankHistory({ previousPosition: null, snapshotCount: 1 })).toBe(false);
    expect(hasRankHistory({ previousPosition: null, snapshotCount: 0 })).toBe(false);
    expect(
      displayRankChangeKind({ previousPosition: null, lastPosition: 5, snapshotCount: 1 }),
    ).toBe("none");
  });

  it("keeps 'entered' semantics after at least two checks", () => {
    expect(hasRankHistory({ previousPosition: null, snapshotCount: 2 })).toBe(true);
    expect(
      displayRankChangeKind({ previousPosition: null, lastPosition: 5, snapshotCount: 2 }),
    ).toBe("entered");
    expect(
      displayRankChangeKind({ previousPosition: 9, lastPosition: 5, snapshotCount: 2 }),
    ).toBe("up");
  });
});
