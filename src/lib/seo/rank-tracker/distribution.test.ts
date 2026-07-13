import { describe, expect, it } from "vitest";
import { rankDistribution, topMovers } from "@/lib/seo/rank-tracker/distribution";

describe("rankDistribution", () => {
  it("buckets positions", () => {
    expect(rankDistribution([1, 3, 7, 15, 55, null, 150])).toEqual({
      top3: 2,
      top10: 1,
      top20: 1,
      top100: 1,
      unranked: 2,
    });
  });
});

describe("topMovers", () => {
  const kws = [
    { keyword: "a", previousPosition: 20, currentPosition: 5 }, // +15
    { keyword: "b", previousPosition: 3, currentPosition: 9 }, // -6
    { keyword: "c", previousPosition: null, currentPosition: 50 }, // +51
    { keyword: "d", previousPosition: 8, currentPosition: null }, // -93
    { keyword: "e", previousPosition: 4, currentPosition: 4 }, // 0
  ];

  it("splits ups and downs sorted by magnitude", () => {
    const { up, down } = topMovers(kws);
    expect(up.map((m) => m.keyword)).toEqual(["c", "a"]);
    expect(down.map((m) => m.keyword)).toEqual(["d", "b"]);
  });

  it("respects limit and ignores unchanged", () => {
    const { up } = topMovers(kws, 1);
    expect(up).toHaveLength(1);
    expect(up[0].keyword).toBe("c");
  });
});
