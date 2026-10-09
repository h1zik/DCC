import { describe, expect, it } from "vitest";
import {
  blendBenchmark,
  cleanPeerRates,
  peerMedian,
  peerPercentile,
} from "@/lib/brand-research/influencer/peer-benchmark";

describe("blendBenchmark", () => {
  it("returns the static benchmark when there are no peers", () => {
    expect(blendBenchmark(2.2, null, 0)).toBe(2.2);
    expect(blendBenchmark(2.2, 4, 0)).toBe(2.2);
  });

  it("moves halfway (geometrically) at 30 peers", () => {
    expect(blendBenchmark(2, 8, 30)).toBeCloseTo(4, 6);
  });

  it("barely moves with a handful of peers", () => {
    const b = blendBenchmark(2, 8, 3);
    expect(b).toBeGreaterThan(2);
    expect(b).toBeLessThan(2.5);
  });
});

describe("peerPercentile", () => {
  const dist = Array.from({ length: 20 }, (_, i) => i + 1);

  it("is null below the minimum peer count", () => {
    expect(peerPercentile(5, dist.slice(0, 10))).toBeNull();
  });

  it("counts ties as half", () => {
    expect(peerPercentile(10, dist)).toBe(48);
    expect(peerPercentile(100, dist)).toBe(100);
    expect(peerPercentile(0, dist)).toBe(0);
  });
});

describe("cleanPeerRates / peerMedian", () => {
  it("drops unusable rates", () => {
    expect(cleanPeerRates([1, 0, -2, Number.NaN, 3])).toEqual([1, 3]);
    expect(cleanPeerRates(undefined)).toEqual([]);
  });

  it("computes the median", () => {
    expect(peerMedian([3, 1, 2])).toBe(2);
    expect(peerMedian([])).toBeNull();
  });
});
