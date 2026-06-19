import { describe, expect, it } from "vitest";
import { resolveDigestQuality } from "@/lib/research/trend-radar/trend-signal-types";

describe("resolveDigestQuality", () => {
  it("returns FAILED when signal count is below 5", () => {
    const q = resolveDigestQuality(3);
    expect(q.digestMode).toBe("FAILED");
    expect(q.dataNotice).toMatch(/3 sinyal/);
  });

  it("returns PARTIAL for 5–14 signals", () => {
    const q = resolveDigestQuality(10);
    expect(q.digestMode).toBe("PARTIAL");
    expect(q.dataNotice).toMatch(/parsial/i);
  });

  it("returns LIVE for 15+ signals", () => {
    const q = resolveDigestQuality(20);
    expect(q.digestMode).toBe("LIVE");
    expect(q.dataNotice).toBeNull();
  });
});

describe("dedupeTrendEvidence", () => {
  it("keeps one row per signalId", async () => {
    const { dedupeTrendEvidence } = await import(
      "@/lib/research/trend-radar/trend-signal-types"
    );
    const rows = dedupeTrendEvidence([
      {
        signalId: "abc123",
        source: "review_intel",
        term: "breakout",
        metric: "complaint_count",
        value: 5,
      },
      {
        signalId: "abc123",
        source: "review_intel",
        term: "breakout",
        metric: "complaint_count",
        value: 12,
      },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.value).toBe(12);
  });
});
