import { describe, expect, it } from "vitest";
import {
  ctrForPosition,
  medianKnownVolume,
  visibilityBreakdown,
  shareOfVoice,
  visibilityScore,
} from "@/lib/seo/rank-tracker/visibility";

describe("ctrForPosition", () => {
  it("returns curve values and 0 outside range", () => {
    expect(ctrForPosition(1)).toBeCloseTo(0.32);
    expect(ctrForPosition(10)).toBeCloseTo(0.02);
    expect(ctrForPosition(21)).toBe(0);
    expect(ctrForPosition(null)).toBe(0);
  });
});

describe("visibilityScore", () => {
  it("is 100 when everything ranks #1 and 0 when nothing ranks", () => {
    expect(
      visibilityScore([
        { position: 1, searchVolume: 1000 },
        { position: 1, searchVolume: 50 },
      ]),
    ).toBe(100);
    expect(
      visibilityScore([
        { position: null, searchVolume: 1000 },
        { position: 40, searchVolume: 500 },
      ]),
    ).toBe(0);
    expect(visibilityScore([])).toBe(0);
  });

  it("weights by volume", () => {
    const highVolTop = visibilityScore([
      { position: 1, searchVolume: 10000 },
      { position: null, searchVolume: 10 },
    ]);
    const lowVolTop = visibilityScore([
      { position: null, searchVolume: 10000 },
      { position: 1, searchVolume: 10 },
    ]);
    expect(highVolTop).toBeGreaterThan(lowVolTop);
  });

  it("degrades to position weighting when volume missing", () => {
    const score = visibilityScore([
      { position: 5, searchVolume: null },
      { position: null, searchVolume: null },
    ]);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(100);
  });
});

describe("shareOfVoice", () => {
  it("computes visibility per domain sorted desc", () => {
    const rows = [
      {
        volume: 1000,
        positions: { "brand.com": 3, "kompetitor.com": 1 },
      },
      {
        volume: 500,
        positions: { "brand.com": 1, "kompetitor.com": null },
      },
    ];
    const sov = shareOfVoice(rows);
    expect(sov).toHaveLength(2);
    expect(sov[0].domain).toBe("kompetitor.com");
    expect(sov[0].visibility).toBeGreaterThan(0);
    expect(sov.find((s) => s.domain === "brand.com")!.visibility).toBeGreaterThan(0);
  });
});

describe("median fallback for unknown volumes", () => {
  it("computes the median of known volumes", () => {
    expect(medianKnownVolume([])).toBeNull();
    expect(
      medianKnownVolume([
        { position: 1, searchVolume: null },
        { position: 1, searchVolume: 0 },
      ]),
    ).toBeNull();
    expect(
      medianKnownVolume([
        { position: 1, searchVolume: 100 },
        { position: 1, searchVolume: 5000 },
        { position: 1, searchVolume: 300 },
      ]),
    ).toBe(300);
    expect(
      medianKnownVolume([
        { position: 1, searchVolume: 100 },
        { position: 1, searchVolume: 300 },
      ]),
    ).toBe(200);
  });

  it("weights unknown-volume keywords by the median, not by 1", () => {
    // Dua keyword volume besar ranking #1, satu keyword tanpa volume tidak ranking.
    const withMedian = visibilityBreakdown([
      { position: 1, searchVolume: 1000 },
      { position: 1, searchVolume: 1000 },
      { position: null, searchVolume: null },
    ]);
    expect(withMedian.unknownVolumeCount).toBe(1);
    expect(withMedian.fallbackVolume).toBe(1000);
    // Bobot median 1000 → keyword tanpa volume menyumbang 1/3 potensi → 66.7%.
    expect(withMedian.score).toBeCloseTo(66.7, 1);
  });

  it("falls back to unweighted (1) when no volume is known", () => {
    const b = visibilityBreakdown([
      { position: 1, searchVolume: null },
      { position: null, searchVolume: null },
    ]);
    expect(b.fallbackVolume).toBe(1);
    expect(b.unknownVolumeCount).toBe(2);
    expect(b.score).toBe(50);
  });

  it("reports zero unknown when every keyword has volume", () => {
    const b = visibilityBreakdown([{ position: 3, searchVolume: 10 }]);
    expect(b.unknownVolumeCount).toBe(0);
  });
});
