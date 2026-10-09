import { describe, expect, it } from "vitest";
import { readAuditTrust } from "@/lib/brand-research/influencer/metrics-view";

describe("readAuditTrust", () => {
  it("treats audits without a version as the old method", () => {
    const t = readAuditTrust({ engagementCv: 0.4 });
    expect(t.scoringVersion).toBe(1);
    expect(t.scoreInterval).toBeNull();
    expect(t.reliability).toBeNull();
    expect(t.verdictReasons).toEqual([]);
  });

  it("survives junk JSON", () => {
    expect(readAuditTrust(null).scoringVersion).toBe(1);
    expect(readAuditTrust("x").peerCount).toBe(0);
    expect(readAuditTrust([1, 2]).scoreInterval).toBeNull();
  });

  it("reads v2 fields", () => {
    const t = readAuditTrust({
      scoringVersion: 2,
      scoreInterval: [61, 78],
      erInterval: [1.9, 3.1],
      reliability: 82,
      reliabilityFactors: { sample: 1, views: 0.85, junk: "x" },
      peer: { n: 24, percentile: 72, medianEr: 2.4, staticBenchmarkEr: 2.2 },
      primaryMode: "blended",
      followerGrowth: { pct: 12.5, days: 40, previousFollowers: 40_000 },
      verdictReasons: [
        { code: "WIDE_INTERVAL", text: "x", effect: "down" },
        { code: "BAD", text: "y", effect: "explode" },
      ],
    });
    expect(t.scoringVersion).toBe(2);
    expect(t.scoreInterval).toEqual([61, 78]);
    expect(t.reliabilityFactors).toEqual({ sample: 1, views: 0.85 });
    expect(t.peerPercentile).toBe(72);
    expect(t.peerCount).toBe(24);
    expect(t.primaryMode).toBe("blended");
    expect(t.followerGrowth?.pct).toBe(12.5);
    expect(t.verdictReasons.map((r) => r.code)).toEqual(["WIDE_INTERVAL"]);
  });
});
