import {
  InfluencerPlatform,
  InfluencerTier,
  InfluencerVerdict,
} from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  applyInfluencerFilters,
  countActiveInfluencerFilters,
  DEFAULT_INFLUENCER_FILTERS,
  isInfluencerFilterActive,
  matchesInfluencerFilter,
  sortInfluencers,
  VERDICT_GROUP,
  type FilterableInfluencer,
  type InfluencerFilterState,
} from "@/lib/brand-research/influencer/list-filter";

function row(
  overrides: Partial<FilterableInfluencer> & { handle: string },
): FilterableInfluencer {
  return {
    displayName: null,
    platform: InfluencerPlatform.INSTAGRAM,
    tier: InfluencerTier.MICRO,
    verdict: InfluencerVerdict.GOOD,
    score: 70,
    engagementRate: 2.5,
    expectedCampaignEr: 2.0,
    followers: 50_000,
    ...overrides,
  };
}

function filters(
  overrides: Partial<InfluencerFilterState> = {},
): InfluencerFilterState {
  return { ...DEFAULT_INFLUENCER_FILTERS, ...overrides };
}

describe("search", () => {
  const r = row({ handle: "nabilasyakieb", displayName: "Nabila Syakieb" });

  it("matches on handle", () => {
    expect(matchesInfluencerFilter(r, filters({ search: "nabila" }))).toBe(true);
  });

  it("matches on display name", () => {
    expect(matchesInfluencerFilter(r, filters({ search: "syakieb" }))).toBe(true);
  });

  it("ignores a leading @ so pasting a handle works", () => {
    expect(matchesInfluencerFilter(r, filters({ search: "@nabila" }))).toBe(true);
  });

  it("is case- and whitespace-insensitive", () => {
    expect(matchesInfluencerFilter(r, filters({ search: "  NABILA " }))).toBe(true);
  });

  it("rejects a non-match", () => {
    expect(matchesInfluencerFilter(r, filters({ search: "jerome" }))).toBe(false);
  });

  it("tolerates a missing display name", () => {
    const bare = row({ handle: "someone", displayName: null });
    expect(matchesInfluencerFilter(bare, filters({ search: "some" }))).toBe(true);
    expect(matchesInfluencerFilter(bare, filters({ search: "zzz" }))).toBe(false);
  });
});

describe("verdict groups", () => {
  const excellent = row({ handle: "a", verdict: InfluencerVerdict.EXCELLENT });
  const good = row({ handle: "b", verdict: InfluencerVerdict.GOOD });
  const average = row({ handle: "c", verdict: InfluencerVerdict.AVERAGE });
  const needsReview = row({ handle: "d", verdict: InfluencerVerdict.NEEDS_REVIEW });
  const suspicious = row({ handle: "e", verdict: InfluencerVerdict.SUSPICIOUS });
  const unaudited = row({ handle: "f", verdict: null });

  const all = [excellent, good, average, needsReview, suspicious, unaudited];

  it("'layak dipakai' covers only Sangat bagus and Bagus", () => {
    const kept = all.filter((r) =>
      matchesInfluencerFilter(r, filters({ verdict: VERDICT_GROUP.USABLE })),
    );
    expect(kept.map((r) => r.handle)).toEqual(["a", "b"]);
  });

  it("'perlu diperiksa' covers Perlu dicek and Mencurigakan", () => {
    const kept = all.filter((r) =>
      matchesInfluencerFilter(r, filters({ verdict: VERDICT_GROUP.FLAGGED })),
    );
    expect(kept.map((r) => r.handle)).toEqual(["d", "e"]);
  });

  it("'belum diaudit' catches rows without a verdict", () => {
    const kept = all.filter((r) =>
      matchesInfluencerFilter(r, filters({ verdict: VERDICT_GROUP.UNAUDITED })),
    );
    expect(kept.map((r) => r.handle)).toEqual(["f"]);
  });

  it("filters by a single verdict value", () => {
    const kept = all.filter((r) =>
      matchesInfluencerFilter(r, filters({ verdict: InfluencerVerdict.AVERAGE })),
    );
    expect(kept.map((r) => r.handle)).toEqual(["c"]);
  });

  it("keeps everything by default", () => {
    const kept = all.filter((r) => matchesInfluencerFilter(r, filters()));
    expect(kept).toHaveLength(all.length);
  });
});

describe("platform and tier", () => {
  const ig = row({ handle: "ig", platform: InfluencerPlatform.INSTAGRAM });
  const tt = row({ handle: "tt", platform: InfluencerPlatform.TIKTOK });

  it("filters by platform", () => {
    expect(
      matchesInfluencerFilter(ig, filters({ platform: InfluencerPlatform.TIKTOK })),
    ).toBe(false);
    expect(
      matchesInfluencerFilter(tt, filters({ platform: InfluencerPlatform.TIKTOK })),
    ).toBe(true);
  });

  it("filters by tier", () => {
    const mega = row({ handle: "m", tier: InfluencerTier.MEGA });
    expect(matchesInfluencerFilter(mega, filters({ tier: InfluencerTier.MEGA }))).toBe(
      true,
    );
    expect(matchesInfluencerFilter(mega, filters({ tier: InfluencerTier.NANO }))).toBe(
      false,
    );
  });

  it("excludes unaudited rows from a tier filter, since tier is unknown", () => {
    const unaudited = row({ handle: "u", tier: null });
    expect(
      matchesInfluencerFilter(unaudited, filters({ tier: InfluencerTier.MICRO })),
    ).toBe(false);
  });

  it("combines filters with AND", () => {
    const r = row({
      handle: "x",
      platform: InfluencerPlatform.TIKTOK,
      tier: InfluencerTier.MID,
      verdict: InfluencerVerdict.GOOD,
    });
    expect(
      matchesInfluencerFilter(
        r,
        filters({
          platform: InfluencerPlatform.TIKTOK,
          tier: InfluencerTier.MID,
          verdict: VERDICT_GROUP.USABLE,
        }),
      ),
    ).toBe(true);
    expect(
      matchesInfluencerFilter(
        r,
        filters({ platform: InfluencerPlatform.TIKTOK, tier: InfluencerTier.NANO }),
      ),
    ).toBe(false);
  });
});

describe("sorting", () => {
  const rows = [
    row({ handle: "low", score: 30, engagementRate: 0.5, expectedCampaignEr: 0.4, followers: 900_000 }),
    row({ handle: "high", score: 90, engagementRate: 8, expectedCampaignEr: 7, followers: 12_000 }),
    row({ handle: "mid", score: 60, engagementRate: 3, expectedCampaignEr: 2.5, followers: 300_000 }),
  ];

  it("leaves server order untouched for 'recent'", () => {
    // Profil yang belum diaudit akan tenggelam kalau diurutkan pakai tanggal
    // audit, jadi urutan bawaan server sengaja dipertahankan.
    expect(sortInfluencers(rows, "recent").map((r) => r.handle)).toEqual([
      "low",
      "high",
      "mid",
    ]);
  });

  it("sorts by score descending", () => {
    expect(sortInfluencers(rows, "score").map((r) => r.handle)).toEqual([
      "high",
      "mid",
      "low",
    ]);
  });

  it("sorts by expected campaign ER descending", () => {
    expect(sortInfluencers(rows, "campaignEr").map((r) => r.handle)).toEqual([
      "high",
      "mid",
      "low",
    ]);
  });

  it("sorts by followers descending", () => {
    expect(sortInfluencers(rows, "followers").map((r) => r.handle)).toEqual([
      "low",
      "mid",
      "high",
    ]);
  });

  it("pushes unaudited rows to the bottom instead of treating them as zero", () => {
    const withNulls = [
      row({ handle: "none", score: null }),
      row({ handle: "some", score: 40 }),
    ];
    expect(sortInfluencers(withNulls, "score").map((r) => r.handle)).toEqual([
      "some",
      "none",
    ]);
  });

  it("does not mutate the input array", () => {
    const original = [...rows];
    sortInfluencers(rows, "score");
    expect(rows).toEqual(original);
  });
});

describe("applyInfluencerFilters", () => {
  it("filters then sorts", () => {
    const rows = [
      row({ handle: "a", verdict: InfluencerVerdict.SUSPICIOUS, score: 20 }),
      row({ handle: "b", verdict: InfluencerVerdict.GOOD, score: 70 }),
      row({ handle: "c", verdict: InfluencerVerdict.EXCELLENT, score: 90 }),
    ];
    const result = applyInfluencerFilters(
      rows,
      filters({ verdict: VERDICT_GROUP.USABLE, sort: "score" }),
    );
    expect(result.map((r) => r.handle)).toEqual(["c", "b"]);
  });

  it("can return an empty list", () => {
    const rows = [row({ handle: "a", verdict: InfluencerVerdict.GOOD })];
    expect(
      applyInfluencerFilters(rows, filters({ search: "tidak ada" })),
    ).toHaveLength(0);
  });
});

describe("active filter tracking", () => {
  it("reports the default state as inactive", () => {
    expect(isInfluencerFilterActive(filters())).toBe(false);
    expect(countActiveInfluencerFilters(filters())).toBe(0);
  });

  it("does not count sort as a filter", () => {
    expect(isInfluencerFilterActive(filters({ sort: "score" }))).toBe(false);
    expect(countActiveInfluencerFilters(filters({ sort: "score" }))).toBe(0);
  });

  it("ignores whitespace-only search", () => {
    expect(isInfluencerFilterActive(filters({ search: "   " }))).toBe(false);
  });

  it("counts each active filter", () => {
    const f = filters({
      search: "nabila",
      platform: InfluencerPlatform.TIKTOK,
      verdict: VERDICT_GROUP.USABLE,
    });
    expect(isInfluencerFilterActive(f)).toBe(true);
    expect(countActiveInfluencerFilters(f)).toBe(3);
  });
});
