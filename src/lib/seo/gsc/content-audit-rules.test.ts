import { describe, expect, it } from "vitest";
import {
  buildAuditRows,
  classifyPageTrend,
  decayOpportunityScore,
} from "@/lib/seo/gsc/content-audit-rules";

describe("classifyPageTrend", () => {
  it("classifies decay only for meaningful prior traffic", () => {
    expect(classifyPageTrend(10, 100)).toBe("decay"); // -90%
    expect(classifyPageTrend(5, 10)).toBe("stable"); // prev < 20, -50% → belum decay
    expect(classifyPageTrend(60, 100)).toBe("decay"); // -40%
    expect(classifyPageTrend(80, 100)).toBe("stable"); // -20% belum decay
  });

  it("flags small pages (prev 6-19) only on sharp drops", () => {
    expect(classifyPageTrend(3, 10)).toBe("decay"); // -70%
    expect(classifyPageTrend(7, 19)).toBe("decay"); // -63%
    expect(classifyPageTrend(8, 19)).toBe("stable"); // -58%
    expect(classifyPageTrend(4, 10)).toBe("decay"); // -60% (ambang)
  });

  it("treats pages that vanished to 0 clicks as decay", () => {
    expect(classifyPageTrend(0, 6)).toBe("decay");
    expect(classifyPageTrend(0, 15)).toBe("decay");
    expect(classifyPageTrend(0, 5)).toBe("stable"); // prev kecil → tetap stabil
  });

  it("classifies rising and fresh", () => {
    expect(classifyPageTrend(30, 20)).toBe("rising"); // +50%
    expect(classifyPageTrend(8, 20)).toBe("decay");
    expect(classifyPageTrend(15, 2)).toBe("fresh");
    expect(classifyPageTrend(3, 1)).toBe("stable");
  });
});

describe("decayOpportunityScore", () => {
  it("stays within 50-95 and grows with lost traffic and drop sharpness", () => {
    const small = decayOpportunityScore({ prevClicks: 10, clicks: 7 });
    const mid = decayOpportunityScore({ prevClicks: 100, clicks: 50 });
    const big = decayOpportunityScore({ prevClicks: 1000, clicks: 0 });
    expect(small).toBeGreaterThanOrEqual(50);
    expect(big).toBeLessThanOrEqual(95);
    expect(small).toBeLessThan(mid);
    expect(mid).toBeLessThan(big);
    // Drop lebih tajam pada trafik sama → skor lebih tinggi.
    expect(
      decayOpportunityScore({ prevClicks: 100, clicks: 10 }),
    ).toBeGreaterThan(decayOpportunityScore({ prevClicks: 100, clicks: 60 }));
  });

  it("handles zero previous clicks without NaN", () => {
    expect(decayOpportunityScore({ prevClicks: 0, clicks: 0 })).toBe(50);
  });
});

describe("buildAuditRows", () => {
  it("merges current/previous, detects vanished pages, sorts decay first", () => {
    const { rows, summary } = buildAuditRows({
      current: [
        { page: "https://a.com/naik", clicks: 50, impressions: 900 },
        { page: "https://a.com/turun", clicks: 10, impressions: 500 },
      ],
      previous: [
        { page: "https://a.com/turun", clicks: 100 },
        { page: "https://a.com/naik", clicks: 20 },
        { page: "https://a.com/hilang", clicks: 40 },
      ],
      pageQueries: [
        { page: "https://a.com/turun", query: "serum niacinamide", clicks: 6 },
        { page: "https://a.com/turun", query: "toner", clicks: 2 },
      ],
    });

    expect(rows[0].page).toBe("https://a.com/turun");
    expect(rows[0].status).toBe("decay");
    expect(rows[0].deltaPct).toBe(-90);
    expect(rows[0].topQueries[0].query).toBe("serum niacinamide");

    const vanished = rows.find((r) => r.page === "https://a.com/hilang")!;
    expect(vanished.status).toBe("decay");
    expect(vanished.clicks).toBe(0);

    const rising = rows.find((r) => r.page === "https://a.com/naik")!;
    expect(rising.status).toBe("rising");

    expect(summary.decayed).toBe(2);
    expect(summary.rising).toBe(1);
    expect(summary.totalClicks).toBe(60);
    expect(summary.prevTotalClicks).toBe(160);
  });
});
