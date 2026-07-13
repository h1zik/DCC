import { describe, expect, it } from "vitest";
import {
  buildAuditRows,
  classifyPageTrend,
} from "@/lib/seo/gsc/content-audit-rules";

describe("classifyPageTrend", () => {
  it("classifies decay only for meaningful prior traffic", () => {
    expect(classifyPageTrend(10, 100)).toBe("decay"); // -90%
    expect(classifyPageTrend(5, 10)).toBe("stable"); // prev < 20 → bukan decay
    expect(classifyPageTrend(60, 100)).toBe("decay"); // -40%
    expect(classifyPageTrend(80, 100)).toBe("stable"); // -20% belum decay
  });

  it("classifies rising and fresh", () => {
    expect(classifyPageTrend(30, 20)).toBe("rising"); // +50%
    expect(classifyPageTrend(8, 20)).toBe("decay");
    expect(classifyPageTrend(15, 2)).toBe("fresh");
    expect(classifyPageTrend(3, 1)).toBe("stable");
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
