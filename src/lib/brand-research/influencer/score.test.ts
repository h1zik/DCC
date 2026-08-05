import { InfluencerPlatform, InfluencerTier, InfluencerVerdict } from "@prisma/client";
import { describe, expect, it } from "vitest";
import type { NormalizedInfluencerPost } from "@/lib/apify/normalize-influencer";
import {
  benchmarkErFor,
  resolveTier,
  scoreInfluencer,
  selectSample,
  type InfluencerScoreInput,
} from "@/lib/brand-research/influencer/score";

const NOW = new Date("2026-08-05T00:00:00Z");

function post(
  overrides: Partial<NormalizedInfluencerPost> & { daysAgo: number; id: string },
): NormalizedInfluencerPost {
  const { daysAgo, id, ...rest } = overrides;
  // Hanya video yang punya hitungan view, jadi fixture dengan view dianggap
  // Reels kecuali `surface` ditulis eksplisit. Normalizer sungguhan menentukan
  // surface dari sumber datasetnya, bukan dari angka view.
  const inferredSurface: NormalizedInfluencerPost["surface"] =
    (rest.views ?? 0) > 0 ? "reels" : "feed";
  return {
    externalId: id,
    likes: 0,
    comments: 0,
    shares: 0,
    views: 0,
    saves: 0,
    surface: inferredSurface,
    postedAt: new Date(NOW.getTime() - daysAgo * 86_400_000),
    ...rest,
  };
}

/** Akun organik sehat: engagement bervariasi, komentar wajar, view di atas follower. */
function organicPosts(count = 12): NormalizedInfluencerPost[] {
  const likeSeries = [820, 3400, 610, 940, 5200, 700, 1150, 480, 2600, 890, 1330, 760];
  return Array.from({ length: count }, (_, i) =>
    post({
      id: `p${i}`,
      daysAgo: i * 3,
      likes: likeSeries[i % likeSeries.length],
      comments: Math.round(likeSeries[i % likeSeries.length] * 0.03),
      shares: Math.round(likeSeries[i % likeSeries.length] * 0.01),
      views: likeSeries[i % likeSeries.length] * 12,
    }),
  );
}

function input(
  overrides: Partial<InfluencerScoreInput> = {},
): InfluencerScoreInput {
  return {
    platform: InfluencerPlatform.INSTAGRAM,
    followers: 50_000,
    following: 800,
    posts: organicPosts(),
    now: NOW,
    ...overrides,
  };
}

describe("resolveTier", () => {
  it("maps follower counts to tiers", () => {
    expect(resolveTier(900)).toBe(InfluencerTier.NANO);
    expect(resolveTier(10_000)).toBe(InfluencerTier.MICRO);
    expect(resolveTier(250_000)).toBe(InfluencerTier.MID);
    expect(resolveTier(700_000)).toBe(InfluencerTier.MACRO);
    expect(resolveTier(4_000_000)).toBe(InfluencerTier.MEGA);
  });
});

describe("benchmarkErFor", () => {
  it("holds TikTok to a much higher bar than Instagram", () => {
    expect(
      benchmarkErFor(InfluencerPlatform.TIKTOK, InfluencerTier.MICRO),
    ).toBeGreaterThan(
      benchmarkErFor(InfluencerPlatform.INSTAGRAM, InfluencerTier.MICRO),
    );
  });

  it("lowers the bar as follower count rises", () => {
    expect(
      benchmarkErFor(InfluencerPlatform.INSTAGRAM, InfluencerTier.NANO),
    ).toBeGreaterThan(
      benchmarkErFor(InfluencerPlatform.INSTAGRAM, InfluencerTier.MEGA),
    );
  });
});

describe("ER definition", () => {
  it("benchmarked ER counts likes and comments only", () => {
    const r = scoreInfluencer(
      input({
        followers: 10_000,
        posts: [
          post({ id: "a", daysAgo: 1, likes: 400, comments: 50, shares: 30, saves: 20 }),
          post({ id: "b", daysAgo: 4, likes: 400, comments: 50, shares: 30, saves: 20 }),
        ],
      }),
    );
    // (400+50)/10000 = 4.5% — share & simpan TIDAK ikut, agar sebanding benchmark.
    expect(r.engagementRate).toBeCloseTo(4.5, 3);
  });

  it("reports a separate full ER that does include shares and saves", () => {
    const r = scoreInfluencer(
      input({
        followers: 10_000,
        posts: [
          post({ id: "a", daysAgo: 1, likes: 400, comments: 50, shares: 30, saves: 20 }),
          post({ id: "b", daysAgo: 4, likes: 400, comments: 50, shares: 30, saves: 20 }),
        ],
      }),
    );
    expect(r.totalEngagementRate).toBeCloseTo(5, 3);
  });

  it("does not inflate TikTok ER against the benchmark via shares", () => {
    // Share besar dulunya menggelembungkan ER TikTok terhadap acuan
    // like+komentar. Sekarang tidak boleh berpengaruh.
    const withShares = scoreInfluencer(
      input({
        platform: InfluencerPlatform.TIKTOK,
        followers: 100_000,
        posts: Array.from({ length: 8 }, (_, i) =>
          post({ id: `p${i}`, daysAgo: i * 2, likes: 5_000 + i * 100, comments: 200, shares: 4_000, saves: 3_000, views: 200_000 }),
        ),
      }),
    );
    const withoutShares = scoreInfluencer(
      input({
        platform: InfluencerPlatform.TIKTOK,
        followers: 100_000,
        posts: Array.from({ length: 8 }, (_, i) =>
          post({ id: `p${i}`, daysAgo: i * 2, likes: 5_000 + i * 100, comments: 200, shares: 0, saves: 0, views: 200_000 }),
        ),
      }),
    );
    expect(withShares.engagementRate).toBeCloseTo(withoutShares.engagementRate, 3);
    expect(withShares.metrics.erVsBenchmark).toBeCloseTo(
      withoutShares.metrics.erVsBenchmark,
      2,
    );
    // Nilainya bagi brand tetap tercatat, hanya tidak dipakai membandingkan.
    expect(withShares.totalEngagementRate).toBeGreaterThan(
      withoutShares.totalEngagementRate,
    );
  });
});

describe("median over mean", () => {
  it("does not let one viral post inflate the engagement rate", () => {
    const base = Array.from({ length: 10 }, (_, i) =>
      post({ id: `p${i}`, daysAgo: i * 3, likes: 1_000, comments: 30, views: 20_000 }),
    );
    const withViral = [
      post({ id: "viral", daysAgo: 1, likes: 500_000, comments: 15_000, views: 9_000_000 }),
      ...base,
    ];

    const plain = scoreInfluencer(input({ followers: 100_000, posts: base }));
    const viral = scoreInfluencer(input({ followers: 100_000, posts: withViral }));

    // Median hampir tidak bergeser walau ada satu post yang meledak.
    expect(viral.engagementRate).toBeCloseTo(plain.engagementRate, 1);
    // Mean tetap dicatat sebagai pembanding, dan jelas jauh lebih tinggi.
    expect(viral.avgLikes).toBeGreaterThan(viral.medianLikes * 5);
  });

  it("flags when a few viral posts dominate the average", () => {
    const posts = [
      post({ id: "viral", daysAgo: 1, likes: 200_000, comments: 6_000, views: 3_000_000 }),
      ...Array.from({ length: 9 }, (_, i) =>
        post({ id: `p${i}`, daysAgo: (i + 1) * 3, likes: 1_000, comments: 30, views: 20_000 }),
      ),
    ];
    const r = scoreInfluencer(input({ followers: 100_000, posts }));
    const viralFlag = r.fakeFlags.find((f) => f.code === "VIRAL_SKEW");
    expect(viralFlag).toBeDefined();
    // Skew soal performa, bukan keaslian — skor keaslian tak boleh terpotong.
    expect(viralFlag?.impact).toBe("performance");
  });
});

describe("posting cadence", () => {
  it("uses the median gap so a pinned old post cannot wreck it", () => {
    // 9 post mingguan + satu post pin berumur dua tahun.
    const weekly = Array.from({ length: 9 }, (_, i) =>
      post({ id: `p${i}`, daysAgo: i * 7, likes: 900, comments: 30, views: 15_000 }),
    );
    const pinned = post({ id: "pinned", daysAgo: 730, likes: 900, comments: 30, views: 15_000 });

    const withoutPin = scoreInfluencer(input({ posts: weekly }));
    const withPin = scoreInfluencer(input({ posts: [...weekly, pinned] }));

    expect(withoutPin.postsPerWeek).toBeCloseTo(1, 1);
    expect(withPin.postsPerWeek).toBeCloseTo(1, 1);
  });

  it("still reports days since the latest post", () => {
    const r = scoreInfluencer(
      input({
        posts: [
          post({ id: "a", daysAgo: 3, likes: 900, comments: 30, views: 15_000 }),
          post({ id: "b", daysAgo: 10, likes: 900, comments: 30, views: 15_000 }),
        ],
      }),
    );
    expect(r.daysSinceLastPost).toBe(3);
  });
});

describe("selectSample", () => {
  it("drops posts older than the 180-day window when enough recent posts exist", () => {
    const recent = Array.from({ length: 8 }, (_, i) =>
      post({ id: `r${i}`, daysAgo: i * 5, likes: 100 }),
    );
    const ancient = post({ id: "old", daysAgo: 700, likes: 100 });
    const sample = selectSample([...recent, ancient], NOW);

    expect(sample).toHaveLength(8);
    expect(sample.map((p) => p.externalId)).not.toContain("old");
  });

  it("falls back to every post when recent ones are too few to judge", () => {
    const posts = [
      post({ id: "a", daysAgo: 10, likes: 100 }),
      post({ id: "b", daysAgo: 400, likes: 100 }),
      post({ id: "c", daysAgo: 500, likes: 100 }),
    ];
    expect(selectSample(posts, NOW)).toHaveLength(3);
  });

  it("keeps undated posts rather than discarding them", () => {
    const posts: NormalizedInfluencerPost[] = [
      { externalId: "a", likes: 10, comments: 1, shares: 0, views: 0, saves: 0, surface: "feed" as const },
      { externalId: "b", likes: 20, comments: 2, shares: 0, views: 0, saves: 0, surface: "feed" as const },
    ];
    expect(selectSample(posts, NOW)).toHaveLength(2);
  });
});

describe("sponsored vs organic split", () => {
  function mixed(): NormalizedInfluencerPost[] {
    const organic = Array.from({ length: 6 }, (_, i) =>
      post({ id: `o${i}`, daysAgo: i * 4, likes: 4_000, comments: 120, views: 60_000, caption: "jalan-jalan pagi" }),
    );
    const sponsored = Array.from({ length: 4 }, (_, i) =>
      post({ id: `s${i}`, daysAgo: i * 4 + 2, likes: 1_000, comments: 30, views: 20_000, caption: "cobain produk baru ini #endorse" }),
    );
    return [...organic, ...sponsored];
  }

  it("computes engagement separately for paid and organic posts", () => {
    const r = scoreInfluencer(input({ followers: 100_000, posts: mixed() }));
    expect(r.sponsored.sponsoredCount).toBe(4);
    expect(r.sponsored.organicCount).toBe(6);
    expect(r.sponsored.sponsoredEr).toBeLessThan(r.sponsored.organicEr as number);
    expect(r.sponsored.deltaPct).toBeLessThan(0);
  });

  it("flags a collapse in paid-post engagement as a performance risk", () => {
    const r = scoreInfluencer(input({ followers: 100_000, posts: mixed() }));
    const flag = r.fakeFlags.find((f) => f.code === "SPONSORED_COLLAPSE");
    expect(flag).toBeDefined();
    expect(flag?.impact).toBe("performance");
    // Bukan tuduhan palsu — keaslian tetap utuh.
    expect(r.authenticityScore).toBe(100);
  });

  it("predicts campaign ER from paid posts when the sample allows", () => {
    const r = scoreInfluencer(input({ followers: 100_000, posts: mixed() }));
    expect(r.metrics.expectedCampaignErSource).toBe("sponsored");
    expect(r.metrics.expectedCampaignEr).toBeCloseTo(
      r.sponsored.sponsoredEr as number,
      3,
    );
  });

  it("falls back to overall ER when there are no paid posts to learn from", () => {
    const r = scoreInfluencer(input());
    expect(r.sponsored.sponsoredCount).toBe(0);
    expect(r.metrics.expectedCampaignErSource).toBe("overall");
    expect(r.metrics.expectedCampaignEr).toBeCloseTo(r.engagementRate, 3);
  });

  it("detects paid posts from the platform marker even without hashtags", () => {
    const posts = [
      ...Array.from({ length: 5 }, (_, i) =>
        post({ id: `o${i}`, daysAgo: i * 4, likes: 3_000, comments: 90, views: 50_000 }),
      ),
      ...Array.from({ length: 3 }, (_, i) =>
        post({ id: `s${i}`, daysAgo: i * 4 + 1, likes: 900, comments: 25, views: 18_000, isSponsoredMeta: true }),
      ),
    ];
    const r = scoreInfluencer(input({ followers: 100_000, posts }));
    expect(r.sponsored.sponsoredCount).toBe(3);
  });
});

describe("view rate is judged per platform", () => {
  /**
   * Akun Instagram nyata: carousel ramai di feed, Reels yang jangkauannya
   * jauh lebih besar tapi like-nya jauh lebih sedikit. Pola ini persis yang
   * ditemukan pada data produksi.
   */
  function mixedInstagram(): NormalizedInfluencerPost[] {
    const feedLikes = [1_600, 2_300, 1_100, 1_850, 1_400, 2_800, 1_250];
    const reelViews = [2_106, 4_528, 3_255, 21_573, 4_675];
    return [
      ...feedLikes.map((n, i) =>
        post({ id: `c${i}`, daysAgo: i * 4, likes: n, comments: Math.round(n * 0.03), surface: "feed" }),
      ),
      ...reelViews.map((v, i) =>
        post({ id: `v${i}`, daysAgo: i * 4 + 2, likes: 90 + i * 12, comments: 3, views: v, surface: "reels" }),
      ),
    ];
  }

  it("does not accuse an Instagram account of fake followers over quiet Reels", () => {
    // Reels didistribusikan lewat rekomendasi, bukan ke follower — Reels sepi
    // bukan bukti follower palsu. Ini penyebab utama salah tuduh sebelumnya.
    const r = scoreInfluencer(input({ followers: 49_667, posts: mixedInstagram() }));

    expect(r.fakeFlags.map((f) => f.code)).not.toContain("LOW_VIEW_RATE");
    expect(r.authenticityScore).toBe(100);
    expect(r.verdict).not.toBe(InfluencerVerdict.SUSPICIOUS);
  });

  it("measures engagement from the feed and reach from Reels, never mixing them", () => {
    const r = scoreInfluencer(input({ followers: 49_667, posts: mixedInstagram() }));

    expect(r.feedPostCount).toBe(7);
    expect(r.reelsPostCount).toBe(5);
    // ER memakai like carousel (median 1.600), bukan like Reels yang jauh lebih kecil.
    expect(r.medianLikes).toBe(1_600);
    // View diambil dari Reels saja (median 4.528), tidak diencerkan post feed.
    expect(r.medianViews).toBe(4_528);
    expect(r.metrics.viewCoverage).toBe(1);
    // Engagement Reels dilaporkan terpisah supaya selisihnya terbaca.
    expect(r.reelsEngagementRate).not.toBeNull();
    expect(r.reelsEngagementRate as number).toBeLessThan(r.engagementRate);
  });

  it("keeps reach neutral when most Reels report no view count", () => {
    const posts = [
      ...Array.from({ length: 6 }, (_, i) =>
        post({ id: `c${i}`, daysAgo: i * 4, likes: 1_500 + i * 90, comments: 40, surface: "feed" }),
      ),
      ...Array.from({ length: 5 }, (_, i) =>
        post({ id: `v${i}`, daysAgo: i * 4 + 1, likes: 80, comments: 3, views: i === 0 ? 3_000 : 0, surface: "reels" }),
      ),
    ];
    const r = scoreInfluencer(input({ followers: 49_667, posts }));
    expect(r.metrics.viewCoverage).toBeLessThan(0.8);
    expect(r.metrics.components.reach).toBe(60);
  });

  it("still uses view rate for reach when videos cover the whole sample", () => {
    const r = scoreInfluencer(
      input({
        platform: InfluencerPlatform.TIKTOK,
        followers: 100_000,
        posts: Array.from({ length: 10 }, (_, i) =>
          post({ id: `p${i}`, daysAgo: i * 3, likes: 3_000, comments: 90, views: 45_000 + i * 500 }),
        ),
      }),
    );
    expect(r.metrics.viewCoverage).toBe(1);
    expect(r.metrics.components.reach).toBeGreaterThan(60);
  });

  it("does not flag dead followers on TikTok when view data is unrepresentative", () => {
    // Semua konten TikTok adalah video; di sini kebanyakan tidak melaporkan
    // view, jadi angka jangkauannya tidak layak dijadikan dasar tuduhan.
    const posts = [
      ...Array.from({ length: 8 }, (_, i) =>
        post({ id: `n${i}`, daysAgo: i * 3, likes: 500, comments: 20, views: 0, surface: "reels" }),
      ),
      post({ id: "v", daysAgo: 1, likes: 500, comments: 20, views: 900, surface: "reels" }),
    ];
    const r = scoreInfluencer(
      input({ platform: InfluencerPlatform.TIKTOK, followers: 100_000, posts }),
    );
    expect(r.fakeFlags.map((f) => f.code)).not.toContain("LOW_VIEW_RATE");
  });
});

describe("verdict requires corroboration", () => {
  /**
   * TEPAT satu sinyal berat: komentar nyaris nol dibanding like, tapi like
   * antar post tetap bervariasi lebar supaya FLAT_ENGAGEMENT tidak ikut nyala.
   */
  function oneHighSignal(): NormalizedInfluencerPost[] {
    const likes = [1_200, 8_000, 2_400, 15_000, 900, 5_600, 3_100, 11_000, 1_800, 6_400];
    return likes.map((n, i) =>
      post({ id: `p${i}`, daysAgo: i * 3, likes: n, comments: 4, views: n * 12 }),
    );
  }

  it("holds a single high signal at NEEDS_REVIEW instead of accusing", () => {
    const r = scoreInfluencer(input({ followers: 80_000, posts: oneHighSignal() }));

    expect(r.metrics.highAuthenticityFlags).toBe(1);
    expect(r.verdict).toBe(InfluencerVerdict.NEEDS_REVIEW);
    expect(r.score).toBeLessThanOrEqual(60);
  });

  it("escalates to SUSPICIOUS once two high signals corroborate", () => {
    // Komentar nyaris nol DAN engagement seragam antar post.
    const r = scoreInfluencer(
      input({
        followers: 80_000,
        posts: Array.from({ length: 12 }, (_, i) =>
          post({ id: `p${i}`, daysAgo: i * 3, likes: 5_000 + (i % 2), comments: 4, views: 60_000 }),
        ),
      }),
    );
    expect(r.metrics.highAuthenticityFlags).toBeGreaterThanOrEqual(2);
    expect(r.verdict).toBe(InfluencerVerdict.SUSPICIOUS);
    expect(r.score).toBeLessThanOrEqual(45);
  });

  it("still escalates when medium signals sink authenticity below 50", () => {
    const r = scoreInfluencer(
      input({
        followers: 20_000,
        following: 25_000, // FOLLOWING_RATIO_HIGH
        posts: Array.from({ length: 10 }, (_, i) =>
          // ER jauh di atas median tier + komentar berlebih = dua sinyal sedang.
          post({ id: `p${i}`, daysAgo: i * 3, likes: 3_000 + i * 200, comments: 900 + i * 40, views: 40_000 + i * 900 }),
        ),
      }),
    );
    expect(r.authenticityScore).toBeLessThan(50);
    expect(r.verdict).toBe(InfluencerVerdict.SUSPICIOUS);
  });

  it("leaves a clean account on the ordinary score scale", () => {
    const r = scoreInfluencer(input());
    expect(r.metrics.highAuthenticityFlags).toBe(0);
    expect(r.verdict).not.toBe(InfluencerVerdict.NEEDS_REVIEW);
    expect(r.verdict).not.toBe(InfluencerVerdict.SUSPICIOUS);
  });
});

describe("flag impact separation", () => {
  it("does not dock authenticity for missing view data", () => {
    // Akun foto Instagram tanpa view bukan akun palsu — itu batas data.
    const posts = Array.from({ length: 10 }, (_, i) =>
      post({ id: `p${i}`, daysAgo: i * 3, likes: 1_200 + i * 90, comments: 40 + i, views: 0 }),
    );
    const r = scoreInfluencer(input({ posts }));
    const flag = r.fakeFlags.find((f) => f.code === "NO_VIEW_DATA");
    expect(flag?.impact).toBe("data");
    expect(flag?.penalty).toBe(0);
    expect(r.authenticityScore).toBe(100);
  });

  it("does not dock authenticity for a thin sample", () => {
    const r = scoreInfluencer(
      input({
        posts: Array.from({ length: 3 }, (_, i) =>
          post({ id: `p${i}`, daysAgo: i * 3, likes: 1_100 + i * 80, comments: 35, views: 18_000 }),
        ),
      }),
    );
    expect(r.fakeFlags.find((f) => f.code === "THIN_SAMPLE")?.impact).toBe("data");
    expect(r.authenticityScore).toBe(100);
    expect(r.confidence).toBe("low");
  });

  it("reports high confidence for a healthy recent sample", () => {
    const r = scoreInfluencer(input());
    expect(r.confidence).toBe("high");
  });

  it("drops confidence when engagement rests on only a few feed posts", () => {
    // Kasus nyata: 28 post terambil, tapi hanya 4 post feed — dan ER dihitung
    // dari 4 itu. Melaporkan "keyakinan tinggi" di sini akan menyesatkan.
    const posts = [
      ...Array.from({ length: 4 }, (_, i) =>
        post({ id: `f${i}`, daysAgo: i * 7, likes: 500 + i * 40, comments: 15, surface: "feed" }),
      ),
      ...Array.from({ length: 24 }, (_, i) =>
        post({ id: `r${i}`, daysAgo: i * 5, likes: 90, comments: 3, views: 4_000 + i * 120, surface: "reels" }),
      ),
    ];
    const r = scoreInfluencer(input({ followers: 49_665, posts }));

    expect(r.postsAnalyzed).toBe(28);
    expect(r.feedPostCount).toBe(4);
    expect(r.confidence).toBe("low");
    expect(r.fakeFlags.map((f) => f.code)).toContain("THIN_SAMPLE");
  });

  it("drops confidence when the sample spans too long a period", () => {
    const posts = [
      post({ id: "a", daysAgo: 5, likes: 900, comments: 30, views: 15_000 }),
      post({ id: "b", daysAgo: 200, likes: 900, comments: 30, views: 15_000 }),
      post({ id: "c", daysAgo: 400, likes: 900, comments: 30, views: 15_000 }),
      post({ id: "d", daysAgo: 600, likes: 900, comments: 30, views: 15_000 }),
    ];
    const r = scoreInfluencer(input({ posts }));
    expect(r.confidence).toBe("low");
    expect(r.fakeFlags.map((f) => f.code)).toContain("WIDE_SAMPLE_WINDOW");
  });
});

describe("fake engagement detection", () => {
  it("flags bought likes when comments are near zero", () => {
    const r = scoreInfluencer(
      input({
        followers: 80_000,
        posts: Array.from({ length: 10 }, (_, i) =>
          post({ id: `p${i}`, daysAgo: i * 3, likes: 5_000 + i * 300, comments: 4, views: 60_000 + i * 1000 }),
        ),
      }),
    );
    expect(r.fakeFlags.map((f) => f.code)).toContain("COMMENT_LIKE_RATIO_LOW");
    expect(r.authenticityScore).toBeLessThan(100);
    expect(r.verdict).toBe(InfluencerVerdict.SUSPICIOUS);
  });

  it("flags engagement pods when comments outnumber likes abnormally", () => {
    const r = scoreInfluencer(
      input({
        posts: Array.from({ length: 10 }, (_, i) =>
          post({ id: `p${i}`, daysAgo: i * 2, likes: 500 + i * 40, comments: 250 + i * 10, views: 9_000 + i * 500 }),
        ),
      }),
    );
    expect(r.fakeFlags.map((f) => f.code)).toContain("COMMENT_LIKE_RATIO_HIGH");
  });

  it("flags dead followers on TikTok when views fall far below follower count", () => {
    const r = scoreInfluencer(
      input({
        platform: InfluencerPlatform.TIKTOK,
        followers: 200_000,
        posts: Array.from({ length: 10 }, (_, i) =>
          post({ id: `p${i}`, daysAgo: i * 2, likes: 300 + i * 50, comments: 12 + i, views: 4_000 + i * 800 }),
        ),
      }),
    );
    expect(r.fakeFlags.map((f) => f.code)).toContain("LOW_VIEW_RATE");
  });

  it("flags suspiciously uniform engagement across posts", () => {
    const r = scoreInfluencer(
      input({
        followers: 60_000,
        posts: Array.from({ length: 12 }, (_, i) =>
          post({ id: `p${i}`, daysAgo: i * 3, likes: 2_000 + (i % 2), comments: 60, views: 25_000 }),
        ),
      }),
    );
    expect(r.fakeFlags.map((f) => f.code)).toContain("FLAT_ENGAGEMENT");
    // Sendirian, sinyal ini menahan untuk diperiksa — belum menuduh.
    expect(r.verdict).toBe(InfluencerVerdict.NEEDS_REVIEW);
  });

  it("does not flag flat engagement on a thin sample", () => {
    const r = scoreInfluencer(
      input({
        posts: Array.from({ length: 4 }, (_, i) =>
          post({ id: `p${i}`, daysAgo: i * 3, likes: 2_000, comments: 60, views: 25_000 }),
        ),
      }),
    );
    expect(r.fakeFlags.map((f) => f.code)).not.toContain("FLAT_ENGAGEMENT");
  });

  it("flags follow/unfollow growth tactics", () => {
    const r = scoreInfluencer(input({ followers: 20_000, following: 25_000 }));
    expect(r.fakeFlags.map((f) => f.code)).toContain("FOLLOWING_RATIO_HIGH");
  });

  it("flags an account that stopped posting without double-penalising it", () => {
    const r = scoreInfluencer(
      input({
        posts: [
          post({ id: "a", daysAgo: 120, likes: 900, comments: 30, views: 12_000 }),
          post({ id: "b", daysAgo: 130, likes: 1_400, comments: 45, views: 20_000 }),
          post({ id: "c", daysAgo: 141, likes: 700, comments: 22, views: 9_000 }),
        ],
      }),
    );
    const stale = r.fakeFlags.find((f) => f.code === "STALE_ACCOUNT");
    expect(stale).toBeDefined();
    expect(r.daysSinceLastPost).toBe(120);
    // Keterlambatan sudah dihitung komponen konsistensi — tidak dipotong dua kali.
    expect(stale?.penalty).toBe(0);
  });

  it("caps the score when a single high-severity authenticity signal fires", () => {
    const r = scoreInfluencer(
      input({
        followers: 60_000,
        posts: Array.from({ length: 12 }, (_, i) =>
          post({ id: `p${i}`, daysAgo: i * 3, likes: 2_000 + (i % 2), comments: 60, views: 25_000 }),
        ),
      }),
    );
    expect(r.authenticityScore).toBe(70);
    // Satu sinyal → batas 60; dua sinyal baru turun ke 45.
    expect(r.score).toBeLessThanOrEqual(60);
    expect(r.verdict).toBe(InfluencerVerdict.NEEDS_REVIEW);
  });
});

describe("tier-relative judgement", () => {
  it("rates the same ER differently depending on tier", () => {
    const posts = (followers: number) =>
      Array.from({ length: 8 }, (_, i) =>
        post({
          id: `p${i}`,
          daysAgo: i * 4,
          likes: followers * (0.01 + (i % 4) * 0.01),
          comments: followers * 0.0006,
          views: followers * (3 + (i % 4)),
        }),
      );

    const nano = scoreInfluencer(input({ followers: 5_000, posts: posts(5_000) }));
    const mega = scoreInfluencer(
      input({ followers: 2_000_000, posts: posts(2_000_000) }),
    );

    expect(nano.engagementRate).toBeCloseTo(mega.engagementRate, 2);
    expect(mega.metrics.components.engagement).toBeGreaterThan(
      nano.metrics.components.engagement,
    );
  });

  it("gives a healthy organic account a good verdict and clean authenticity", () => {
    const r = scoreInfluencer(input());
    expect(r.authenticityScore).toBe(100);
    expect(r.fakeFlags.filter((f) => f.impact === "authenticity")).toHaveLength(0);
    expect([InfluencerVerdict.GOOD, InfluencerVerdict.EXCELLENT]).toContain(r.verdict);
  });
});

describe("edge cases", () => {
  it("survives an account with zero followers", () => {
    const r = scoreInfluencer(input({ followers: 0, posts: [] }));
    expect(r.engagementRate).toBe(0);
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.postsAnalyzed).toBe(0);
  });

  it("survives posts without timestamps", () => {
    const r = scoreInfluencer(
      input({
        posts: [
          { externalId: "a", likes: 100, comments: 5, shares: 0, views: 0, saves: 0, surface: "feed" as const },
          { externalId: "b", likes: 200, comments: 9, shares: 0, views: 0, saves: 0, surface: "feed" as const },
        ],
      }),
    );
    expect(r.daysSinceLastPost).toBeNull();
    expect(r.postsPerWeek).toBe(0);
    expect(r.sampleWindowDays).toBeNull();
  });

  it("ignores zero-view posts when computing view averages", () => {
    const r = scoreInfluencer(
      input({
        posts: [
          post({ id: "a", daysAgo: 1, likes: 100, comments: 3, views: 0 }),
          post({ id: "b", daysAgo: 3, likes: 100, comments: 3, views: 8_000 }),
        ],
      }),
    );
    expect(r.medianViews).toBeCloseTo(8_000, 0);
  });

  it("reports the engagement trend across the sample", () => {
    const r = scoreInfluencer(
      input({
        posts: [
          post({ id: "a", daysAgo: 1, likes: 4_000, comments: 120, views: 40_000 }),
          post({ id: "b", daysAgo: 4, likes: 3_800, comments: 110, views: 38_000 }),
          post({ id: "c", daysAgo: 7, likes: 3_600, comments: 100, views: 36_000 }),
          post({ id: "d", daysAgo: 30, likes: 1_200, comments: 40, views: 12_000 }),
          post({ id: "e", daysAgo: 33, likes: 1_000, comments: 30, views: 10_000 }),
          post({ id: "f", daysAgo: 36, likes: 900, comments: 25, views: 9_000 }),
        ],
      }),
    );
    expect(r.metrics.engagementTrendPct).toBeGreaterThan(0);
  });

  it("records how many posts were fetched versus analysed", () => {
    const recent = Array.from({ length: 8 }, (_, i) =>
      post({ id: `r${i}`, daysAgo: i * 5, likes: 900, comments: 30, views: 15_000 }),
    );
    const ancient = post({ id: "old", daysAgo: 900, likes: 900, comments: 30, views: 15_000 });
    const r = scoreInfluencer(input({ posts: [...recent, ancient] }));
    expect(r.postsFetched).toBe(9);
    expect(r.postsAnalyzed).toBe(8);
  });
});

/**
 * Inti pemisahan permukaan: grid yang lemah tidak boleh menyeret turun akun
 * yang Reels-nya kuat, dan sebaliknya. Yang dipesan brand adalah satu FORMAT,
 * bukan rata-rata akun.
 */
describe("feed dan Reels dinilai sebagai dua produk terpisah", () => {
  /** Grid seadanya, Reels yang jadi kekuatan sesungguhnya. */
  function weakFeedStrongReels(): NormalizedInfluencerPost[] {
    const feedLikes = [220, 380, 190, 300, 250, 420, 200, 310];
    const reelLikes = [2_100, 3_400, 1_900, 2_800, 2_500, 3_900, 2_200, 3_000];
    return [
      ...feedLikes.map((n, i) =>
        post({
          id: `f${i}`,
          daysAgo: i * 7,
          likes: n,
          comments: Math.round(n * 0.03),
          surface: "feed",
        }),
      ),
      ...reelLikes.map((n, i) =>
        post({
          id: `r${i}`,
          daysAgo: i * 7 + 3,
          likes: n,
          comments: Math.round(n * 0.035),
          views: n * 24,
          surface: "reels",
        }),
      ),
    ];
  }

  it("menilai dari Reels ketika Reels jauh lebih kuat daripada grid", () => {
    const r = scoreInfluencer(input({ followers: 50_000, posts: weakFeedStrongReels() }));

    expect(r.primarySurface).toBe("reels");
    expect(r.engagementRate).toBe(r.reelsEngagementRate);
    expect(r.feedEngagementRate as number).toBeLessThan(r.engagementRate);
    // Sebelum pemisahan ini, ER grid 0,5% yang dipakai — di bawah seperempat
    // median tier — dan akun ini tervonis lemah padahal Reels-nya kuat.
    expect(r.metrics.erVsBenchmark).toBeGreaterThan(2);
    expect(r.score).toBeGreaterThan(80);
    expect(r.verdict).toBe(InfluencerVerdict.EXCELLENT);
  });

  it("tetap menilai dari grid ketika grid yang lebih kuat", () => {
    const posts = weakFeedStrongReels().map((p) =>
      p.surface === "feed"
        ? { ...p, likes: p.likes * 12, comments: p.comments * 12 }
        : p,
    );
    const r = scoreInfluencer(input({ followers: 50_000, posts }));

    expect(r.primarySurface).toBe("feed");
    expect(r.engagementRate).toBe(r.feedEngagementRate);
    expect(r.reelsEngagementRate as number).toBeLessThan(r.engagementRate);
  });

  it("melaporkan kedua permukaan dengan definisi ER yang sama persis", () => {
    const r = scoreInfluencer(input({ followers: 50_000, posts: weakFeedStrongReels() }));

    const feed = r.surfaces.find((s) => s.surface === "feed");
    const reels = r.surfaces.find((s) => s.surface === "reels");
    expect(feed?.engagementRate).toBe(r.feedEngagementRate);
    expect(reels?.engagementRate).toBe(r.reelsEngagementRate);
    // Sebanding = boleh dibagi satu sama lain tanpa koreksi apa pun.
    expect(r.metrics.surfaceGapPct).toBeGreaterThan(50);
  });

  it("memberi instruksi format, bukan hukuman, saat selisihnya lebar", () => {
    const r = scoreInfluencer(input({ followers: 50_000, posts: weakFeedStrongReels() }));

    const gap = r.fakeFlags.find((f) => f.code === "SURFACE_GAP");
    expect(gap?.impact).toBe("performance");
    expect(gap?.penalty).toBe(0);
    expect(r.metrics.components.performancePenalty).toBe(0);
  });

  it("tidak menjadikan dua Reels bagus sebagai dasar penilaian", () => {
    // Sampel setipis ini belum layak jadi janji, sekuat apa pun angkanya.
    const posts = [
      ...Array.from({ length: 8 }, (_, i) =>
        post({ id: `f${i}`, daysAgo: i * 5, likes: 300 + i * 20, comments: 9, surface: "feed" }),
      ),
      ...Array.from({ length: 2 }, (_, i) =>
        post({
          id: `r${i}`,
          daysAgo: i * 5 + 2,
          likes: 9_000,
          comments: 300,
          views: 200_000,
          surface: "reels",
        }),
      ),
    ];
    const r = scoreInfluencer(input({ followers: 50_000, posts }));

    expect(r.primarySurface).toBe("feed");
    expect(r.engagementRate).toBe(r.feedEngagementRate);
    // Angka Reels tetap dilaporkan supaya tim bisa memutuskan sendiri.
    expect(r.reelsEngagementRate).not.toBeNull();
  });

  it("tidak menyuruh ganti format berdasarkan satu post saja", () => {
    // Satu post feed yang sepi bukan bukti bahwa feed-nya lemah.
    const posts = [
      post({ id: "f0", daysAgo: 4, likes: 60, comments: 2, surface: "feed" }),
      ...Array.from({ length: 8 }, (_, i) =>
        post({
          id: `r${i}`,
          daysAgo: i * 5,
          likes: 2_400 + i * 100,
          comments: 80,
          views: 60_000,
          surface: "reels",
        }),
      ),
    ];
    const r = scoreInfluencer(input({ followers: 50_000, posts }));

    expect(r.primarySurface).toBe("reels");
    expect(r.metrics.surfaceGapPct).toBeNull();
    expect(r.fakeFlags.map((f) => f.code)).not.toContain("SURFACE_GAP");
    // Angkanya tetap dilaporkan — hanya tidak dijadikan saran.
    expect(r.feedEngagementRate).not.toBeNull();
  });

  it("membandingkan berbayar vs organik di dalam permukaan yang sama", () => {
    const posts = [
      // Grid: organik semua.
      ...Array.from({ length: 6 }, (_, i) =>
        post({ id: `f${i}`, daysAgo: i * 6, likes: 400, comments: 12, surface: "feed" }),
      ),
      // Reels: campuran berbayar dan organik, dan Reels-lah permukaan utamanya.
      ...Array.from({ length: 4 }, (_, i) =>
        post({
          id: `ro${i}`,
          daysAgo: i * 6 + 1,
          likes: 4_000,
          comments: 140,
          views: 90_000,
          surface: "reels",
        }),
      ),
      ...Array.from({ length: 3 }, (_, i) =>
        post({
          id: `rs${i}`,
          daysAgo: i * 6 + 3,
          likes: 1_100,
          comments: 30,
          views: 40_000,
          surface: "reels",
          caption: "Racun check! #endorse",
        }),
      ),
    ];
    const r = scoreInfluencer(input({ followers: 50_000, posts }));

    expect(r.primarySurface).toBe("reels");
    // Post berbayar ada di Reels — sebelumnya tak terlihat sama sekali karena
    // pembandingan hanya berjalan di grid.
    expect(r.sponsored.sponsoredCount).toBe(3);
    expect(r.sponsored.organicCount).toBe(4);
    expect(r.sponsored.deltaPct as number).toBeLessThan(-35);
    expect(r.fakeFlags.map((f) => f.code)).toContain("SPONSORED_COLLAPSE");
    expect(r.metrics.expectedCampaignErSource).toBe("sponsored");
  });

  it("menghitung tren pada himpunan yang sama dengan yang menghasilkan ER", () => {
    // Regresi: dulu indeks tren diambil dari jumlah SELURUH post sampel tapi
    // dipakai memotong array permukaan utama, sehingga separuh "terlama"
    // sering jadi array kosong dan trennya hilang diam-diam.
    const posts = [
      ...[5_000, 4_800, 4_600, 1_400, 1_200, 1_000].map((n, i) =>
        post({
          id: `f${i}`,
          daysAgo: i * 6,
          likes: n,
          comments: Math.round(n * 0.03),
          surface: "feed",
        }),
      ),
      ...Array.from({ length: 12 }, (_, i) =>
        post({
          id: `r${i}`,
          daysAgo: i * 3,
          likes: 300,
          comments: 9,
          views: 20_000,
          surface: "reels",
        }),
      ),
    ];
    const r = scoreInfluencer(input({ followers: 50_000, posts }));

    expect(r.primarySurface).toBe("feed");
    expect(r.metrics.engagementTrendPct).not.toBeNull();
    expect(r.metrics.engagementTrendPct as number).toBeGreaterThan(0);
  });

  it("tidak menuduh engagement seragam bila permukaan lain bervariasi wajar", () => {
    // Reels yang rata adalah ciri format (distribusi algoritmik seragam),
    // bukan ciri paket engagement — apalagi saat feed jelas naik-turun.
    const posts = [
      ...[900, 4_200, 1_300, 6_800, 1_100, 3_400, 800, 5_100].map((n, i) =>
        post({
          id: `f${i}`,
          daysAgo: i * 6,
          likes: n,
          comments: Math.round(n * 0.03),
          surface: "feed",
        }),
      ),
      ...Array.from({ length: 8 }, (_, i) =>
        post({
          id: `r${i}`,
          daysAgo: i * 6 + 2,
          likes: 1_000,
          comments: 30,
          views: 30_000,
          surface: "reels",
        }),
      ),
    ];
    const r = scoreInfluencer(input({ followers: 50_000, posts }));

    expect(r.fakeFlags.map((f) => f.code)).not.toContain("FLAT_ENGAGEMENT");
    expect(r.authenticityScore).toBe(100);
  });
});

describe("like yang disembunyikan bukan like nol", () => {
  function withHiddenLikes(hidden: number, total = 10): NormalizedInfluencerPost[] {
    return Array.from({ length: total }, (_, i) =>
      post({
        id: `p${i}`,
        daysAgo: i * 3,
        likes: i < hidden ? 0 : 1_400 + i * 90,
        likesHidden: i < hidden,
        comments: i < hidden ? 40 : 45,
        views: 30_000,
        surface: "reels",
      }),
    );
  }

  it("mengeluarkan post yang like-nya disembunyikan dari perhitungan", () => {
    const hiddenRun = scoreInfluencer(
      input({ followers: 50_000, posts: withHiddenLikes(3) }),
    );
    const cleanRun = scoreInfluencer(
      input({ followers: 50_000, posts: withHiddenLikes(0) }),
    );

    expect(hiddenRun.metrics.hiddenLikePosts).toBe(3);
    // Kalau -1 diperlakukan sebagai nol, ER akan anjlok jauh di bawah ini.
    expect(hiddenRun.engagementRate).toBeGreaterThan(cleanRun.engagementRate * 0.9);
    const flag = hiddenRun.fakeFlags.find((f) => f.code === "HIDDEN_LIKES");
    expect(flag?.impact).toBe("data");
    expect(flag?.penalty).toBe(0);
  });

  it("menilai netral, bukan nol, saat semua like disembunyikan", () => {
    const r = scoreInfluencer(
      input({ followers: 50_000, posts: withHiddenLikes(10) }),
    );

    expect(r.metrics.components.engagement).toBe(60);
    expect(r.fakeFlags.map((f) => f.code)).toContain("NO_ENGAGEMENT_DATA");
    expect(r.authenticityScore).toBe(100);
    expect(r.verdict).not.toBe(InfluencerVerdict.SUSPICIOUS);
  });
});

describe("rasio komentar tahan outlier dan sadar tier", () => {
  it("tidak menuduh engagement pod gara-gara satu post giveaway", () => {
    const posts = [
      ...Array.from({ length: 9 }, (_, i) =>
        post({ id: `p${i}`, daysAgo: i * 3, likes: 1_000, comments: 30, views: 20_000 }),
      ),
      // Giveaway: puluhan ribu komentar "sudah follow ya kak".
      post({ id: "give", daysAgo: 2, likes: 1_000, comments: 50_000, views: 20_000 }),
    ];
    const r = scoreInfluencer(input({ followers: 50_000, posts }));

    expect(r.fakeFlags.map((f) => f.code)).not.toContain("COMMENT_LIKE_RATIO_HIGH");
    expect(r.metrics.commentLikeRatio).toBeCloseTo(0.03, 2);
  });

  it("menurunkan ambang tuduhan untuk akun mega", () => {
    const posts = Array.from({ length: 10 }, (_, i) =>
      post({
        id: `p${i}`,
        daysAgo: i * 3,
        likes: 40_000 + i * 2_000,
        // 0,25% — wajar untuk audiens mega, mencurigakan untuk micro.
        comments: Math.round((40_000 + i * 2_000) * 0.0025),
        views: 900_000,
      }),
    );

    const mega = scoreInfluencer(input({ followers: 2_000_000, posts }));
    expect(mega.fakeFlags.map((f) => f.code)).not.toContain("COMMENT_LIKE_RATIO_LOW");

    const micro = scoreInfluencer(input({ followers: 50_000, posts }));
    expect(micro.fakeFlags.map((f) => f.code)).toContain("COMMENT_LIKE_RATIO_LOW");
  });
});

describe("kepadatan endorse", () => {
  it("memperingatkan saat isi profilnya didominasi endorse", () => {
    const posts = [
      ...Array.from({ length: 6 }, (_, i) =>
        post({
          id: `s${i}`,
          daysAgo: i * 4,
          likes: 1_200,
          comments: 36,
          views: 25_000,
          caption: "Cobain produk ini ya! #endorse",
        }),
      ),
      ...Array.from({ length: 4 }, (_, i) =>
        post({ id: `o${i}`, daysAgo: i * 4 + 2, likes: 1_300, comments: 39, views: 26_000 }),
      ),
    ];
    const r = scoreInfluencer(input({ followers: 50_000, posts }));

    expect(r.metrics.sponsoredCountAllSurfaces).toBe(6);
    expect(r.metrics.sponsoredShare).toBeCloseTo(0.6, 2);
    const flag = r.fakeFlags.find((f) => f.code === "SPONSORED_CLUTTER");
    expect(flag?.impact).toBe("performance");
    expect(flag?.penalty).toBe(6);
  });
});

describe("jangkauan Reels tidak dipakai saat datanya tidak lengkap", () => {
  it("tidak memperingatkan jangkauan rendah dari satu Reels saja", () => {
    const posts = [
      ...Array.from({ length: 6 }, (_, i) =>
        post({ id: `f${i}`, daysAgo: i * 4, likes: 1_500 + i * 90, comments: 45, surface: "feed" }),
      ),
      ...Array.from({ length: 5 }, (_, i) =>
        post({
          id: `r${i}`,
          daysAgo: i * 4 + 1,
          likes: 900,
          comments: 27,
          views: i === 0 ? 900 : 0,
          surface: "reels",
        }),
      ),
    ];
    const r = scoreInfluencer(input({ followers: 50_000, posts }));

    expect(r.metrics.viewDataRepresentative).toBe(false);
    expect(r.fakeFlags.map((f) => f.code)).not.toContain("LOW_REELS_REACH");
    expect(r.fakeFlags.map((f) => f.code)).toContain("PARTIAL_VIEW_DATA");
    expect(r.metrics.components.reach).toBe(60);
  });
});

describe("vonis terbaik menuntut bukti yang cukup", () => {
  it("menahan vonis tertinggi saat sampelnya masih tipis", () => {
    const posts = Array.from({ length: 4 }, (_, i) =>
      post({ id: `p${i}`, daysAgo: i * 3, likes: 3_000 + i * 200, comments: 95, views: 400_000 }),
    );
    const r = scoreInfluencer(input({ followers: 50_000, posts }));

    expect(r.confidence).toBe("low");
    expect(r.score).toBeGreaterThanOrEqual(80);
    expect(r.verdict).toBe(InfluencerVerdict.GOOD);
  });
});

describe("risiko asosiasi merek", () => {
  function withGamblingCaption(): NormalizedInfluencerPost[] {
    const posts = organicPosts();
    posts[2] = {
      ...posts[2],
      caption: "Cuan terus malam ini, main di situs slot gacor maxwin! Link di bio",
    };
    return posts;
  }

  it("menahan rekomendasi meski angkanya bagus", () => {
    const clean = scoreInfluencer(input());
    expect(clean.verdict).toBe(InfluencerVerdict.EXCELLENT);

    const risky = scoreInfluencer(input({ posts: withGamblingCaption() }));
    expect(risky.brandSafety.worstSeverity).toBe("high");
    expect(risky.verdict).toBe(InfluencerVerdict.NEEDS_REVIEW);
  });

  it("tidak memotong skor keaslian maupun performa", () => {
    const risky = scoreInfluencer(input({ posts: withGamblingCaption() }));
    const flag = risky.fakeFlags.find((f) => f.code === "BRAND_SAFETY_JUDI");

    expect(flag?.impact).toBe("brandSafety");
    expect(flag?.penalty).toBe(0);
    // Keaslian mengukur apakah engagement-nya nyata — itu tidak berubah.
    expect(risky.authenticityScore).toBe(100);
    expect(risky.score).toBe(scoreInfluencer(input()).score);
  });

  it("memindai post di luar jendela sampel juga", () => {
    // Post judi delapan bulan lalu tetap terpampang di profil.
    const posts = [
      ...organicPosts(),
      post({
        id: "old-risk",
        daysAgo: 240,
        likes: 900,
        comments: 30,
        caption: "Jangan lupa main judi online ya guys",
      }),
    ];
    const r = scoreInfluencer(input({ posts }));

    expect(r.postsAnalyzed).toBe(12);
    expect(r.brandSafety.scannedPosts).toBe(13);
    expect(r.brandSafety.hits.map((h) => h.category)).toContain("JUDI");
  });

  it("tidak menandai caption biasa", () => {
    const r = scoreInfluencer(input());
    expect(r.brandSafety.hits).toHaveLength(0);
    expect(r.metrics.brandSafetyWorstSeverity).toBeNull();
  });
});
