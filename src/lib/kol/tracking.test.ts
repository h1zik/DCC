import { describe, expect, it } from "vitest";
import { normalizePostItem } from "@/lib/apify/normalize-influencer";
import { computePostMetrics, cpm, cpv, viewsPerThousandRupiah } from "@/lib/kol/metrics";
import { parsePostUrl, tryParsePostUrl } from "@/lib/kol/post-url";
import { computeRateBand, rateVerdict } from "@/lib/kol/rate-card";

describe("parsePostUrl", () => {
  it("TikTok video → id numerik", () => {
    const p = parsePostUrl("https://www.tiktok.com/@dominatus/video/7412345678901234567?is_from_webapp=1");
    expect(p).toEqual({
      platform: "TIKTOK",
      key: "7412345678901234567",
      url: "https://www.tiktok.com/@dominatus/video/7412345678901234567",
    });
  });

  it("Instagram reel/reels/p → shortcode", () => {
    expect(parsePostUrl("https://instagram.com/reel/C9abcDEF12/?igsh=x").key).toBe("C9abcDEF12");
    expect(parsePostUrl("https://www.instagram.com/reels/C9abcDEF12/").url).toBe(
      "https://www.instagram.com/reel/C9abcDEF12/",
    );
    expect(parsePostUrl("https://www.instagram.com/p/C9abcDEF12/").platform).toBe("INSTAGRAM");
  });

  it("menolak link profil, link pendek, dan domain lain", () => {
    expect(() => parsePostUrl("https://www.tiktok.com/@dominatus")).toThrow();
    expect(() => parsePostUrl("https://vt.tiktok.com/ZSabc/")).toThrow(/pendek/);
    expect(() => parsePostUrl("https://www.instagram.com/dominatus/")).toThrow();
    expect(() => parsePostUrl("https://youtube.com/watch?v=1")).toThrow();
    expect(tryParsePostUrl("bukan url")).toBeNull();
  });
});

describe("normalizePostItem", () => {
  it("TikTok clockworks", () => {
    const p = normalizePostItem("TIKTOK", {
      id: "7412345678901234567",
      webVideoUrl: "https://www.tiktok.com/@a/video/7412345678901234567",
      playCount: 1_250_000,
      diggCount: 90_000,
      commentCount: 1_200,
      shareCount: 3_400,
      collectCount: 800,
    });
    expect(p?.externalId).toBe("7412345678901234567");
    expect(p?.views).toBe(1_250_000);
    expect(p?.shares).toBe(3_400);
  });

  it("Instagram posts mode", () => {
    const p = normalizePostItem("INSTAGRAM", {
      id: "333",
      shortCode: "C9abcDEF12",
      url: "https://www.instagram.com/p/C9abcDEF12/",
      videoPlayCount: 54_000,
      videoViewCount: 21_000,
      likesCount: 4_100,
      commentsCount: 88,
    });
    expect(p?.shortCode).toBe("C9abcDEF12");
    expect(p?.views).toBe(54_000); // ambil hitungan play terbesar
    expect(p?.likes).toBe(4_100);
  });
});

describe("computePostMetrics", () => {
  const snaps = [
    { day: "2026-10-01", views: 100_000, likes: 5_000, comments: 100, shares: 50 },
    { day: "2026-10-02", views: 700_000, likes: 30_000, comments: 400, shares: 900 },
    { day: "2026-10-03", views: 1_100_000, likes: 41_000, comments: 500, shares: 1_100 },
    { day: "2026-10-04", views: 1_200_000, likes: 43_000, comments: 520, shares: 1_150 },
  ];

  it("velocity, puncak, decay, FYP, momentum", () => {
    const m = computePostMetrics(snaps, {
      fypThreshold: 1_000_000,
      postedAt: "2026-10-01T12:00:00+07:00",
    });
    expect(m.velocity.map((v) => v.delta)).toEqual([100_000, 600_000, 400_000, 100_000]);
    expect(m.peakVelocity).toBe(600_000);
    expect(m.peakDay).toBe("2026-10-02");
    expect(m.timeToPeakHours).toBe(36);
    expect(m.decayRate).toBeCloseTo(83.3, 1);
    expect(m.isFyp).toBe(true);
    expect(m.fypDay).toBe("2026-10-03");
    expect(m.momentum).toBe("turun");
  });

  it("views yang terbaca turun tidak menghasilkan kenaikan negatif", () => {
    const m = computePostMetrics(
      [
        { day: "2026-10-01", views: 5_000, likes: 0, comments: 0, shares: 0 },
        { day: "2026-10-02", views: 4_800, likes: 0, comments: 0, shares: 0 },
      ],
      { fypThreshold: 1_000_000 },
    );
    expect(m.velocity[1].delta).toBe(0);
    expect(m.isFyp).toBe(false);
  });

  it("tanpa snapshot", () => {
    expect(computePostMetrics([], { fypThreshold: 1 }).latest).toBeNull();
  });

  it("CPV, CPM, views per Rp1.000", () => {
    expect(cpv(2_000_000, 1_000_000)).toBe(2);
    expect(cpm(2_000_000, 1_000_000)).toBe(2_000);
    expect(viewsPerThousandRupiah(2_000_000, 1_000_000)).toBe(500);
    expect(cpm(0, 1_000_000)).toBeNull(); // barter
    expect(cpm(1_000, 0)).toBeNull();
  });
});

describe("rate card", () => {
  it("fair price = median views ÷ 1000 × CPM, band floor/ceiling", () => {
    const band = computeRateBand(50_000, 15_000, 80, 120)!;
    expect(band).toEqual({ fair: 750_000, floor: 600_000, ceiling: 900_000 });
    expect(rateVerdict(500_000, band)).toBe("GOOD_DEAL");
    expect(rateVerdict(750_000, band)).toBe("FAIR");
    expect(rateVerdict(1_000_000, band)).toBe("OVERPRICED");
  });

  it("tanpa median views tidak ada band", () => {
    expect(computeRateBand(0, 15_000, 80, 120)).toBeNull();
  });
});
