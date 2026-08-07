import { InfluencerPlatform } from "@prisma/client";
import { describe, expect, it } from "vitest";
import type {
  NormalizedInfluencerPost,
  NormalizedInfluencerProfile,
} from "@/lib/apify/normalize-influencer";
import { groupInfluencerDatasetByHandle } from "@/lib/apify/normalize-influencer";
import { buildSnapshotMetrics } from "@/lib/brand-research/influencer/discovery/snapshot";

const NOW = new Date("2026-08-07T00:00:00Z");

function post(
  daysAgo: number,
  overrides: Partial<NormalizedInfluencerPost> = {},
): NormalizedInfluencerPost {
  return {
    externalId: `post-${daysAgo}-${Math.random()}`,
    likes: 500,
    comments: 20,
    shares: 0,
    views: 5000,
    saves: 0,
    surface: "reels",
    postedAt: new Date(NOW.getTime() - daysAgo * 86_400_000),
    ...overrides,
  };
}

function profile(
  overrides: Partial<NormalizedInfluencerProfile> = {},
): NormalizedInfluencerProfile {
  return {
    handle: "kreator",
    isVerified: false,
    isPrivate: false,
    followers: 20_000,
    following: 500,
    postCount: 120,
    posts: [2, 5, 8, 11, 14, 17, 20, 23].map((d) => post(d)),
    ...overrides,
  };
}

describe("buildSnapshotMetrics", () => {
  it("menghitung angka dasar dari sampel tipis", () => {
    const m = buildSnapshotMetrics(
      InfluencerPlatform.TIKTOK,
      profile(),
      NOW,
    );

    expect(m.followers).toBe(20_000);
    expect(m.tier).toBe("MICRO");
    expect(m.postsSampled).toBe(8);
    expect(m.medianLikes).toBe(500);
    // (500 + 20) / 20.000 = 2,6%
    expect(m.engagementRate).toBeCloseTo(2.6, 1);
    expect(m.benchmarkEr).toBeGreaterThan(0);
    expect(m.daysSinceLastPost).toBe(2);
  });

  it("TIDAK memulangkan vonis atau skor keaslian", () => {
    // Inti pemisahan snapshot dari audit: sampel 8 post tidak cukup untuk
    // menuduh siapa pun, jadi ketiganya tidak boleh ada di bentuk keluaran.
    const m = buildSnapshotMetrics(InfluencerPlatform.TIKTOK, profile(), NOW);

    expect(m).not.toHaveProperty("verdict");
    expect(m).not.toHaveProperty("authenticityScore");
    expect(m).not.toHaveProperty("fakeFlags");
  });

  it("melaporkan keyakinan rendah — dan itu jujur untuk sampel setipis ini", () => {
    const m = buildSnapshotMetrics(InfluencerPlatform.TIKTOK, profile(), NOW);
    expect(["low", "medium", "high"]).toContain(m.confidence);
  });

  it("membedakan 'tidak terukur' dari 'nol'", () => {
    // Seluruh like disembunyikan: ER tidak diketahui, BUKAN nol. Melaporkannya
    // sebagai 0 akan membuat akun sehat tenggelam di dasar peringkat.
    const m = buildSnapshotMetrics(
      InfluencerPlatform.INSTAGRAM,
      profile({
        posts: [2, 5, 8, 11, 14, 17].map((d) =>
          post(d, { likes: 0, likesHidden: true, surface: "feed" }),
        ),
      }),
      NOW,
    );

    expect(m.engagementRate).toBeNull();
    expect(m.followers).toBe(20_000);
  });

  it("tidak meledak saat follower nol atau post kosong", () => {
    const noFollowers = buildSnapshotMetrics(
      InfluencerPlatform.TIKTOK,
      profile({ followers: 0 }),
      NOW,
    );
    expect(noFollowers.engagementRate).toBeNull();
    expect(noFollowers.tier).toBeNull();

    const noPosts = buildSnapshotMetrics(
      InfluencerPlatform.TIKTOK,
      profile({ posts: [] }),
      NOW,
    );
    expect(noPosts.postsSampled).toBe(0);
    expect(noPosts.engagementRate).toBeNull();
  });
});

describe("groupInfluencerDatasetByHandle", () => {
  it("memisahkan video TikTok per pemiliknya", () => {
    // Tanpa pengelompokan ini, normalizer mengambil authorMeta dari item mana
    // pun — dan 50 kreator akan tercatat dengan follower orang yang pertama.
    const groups = groupInfluencerDatasetByHandle(InfluencerPlatform.TIKTOK, [
      { id: "1", authorMeta: { name: "nana", fans: 10_000 } },
      { id: "2", authorMeta: { name: "budi", fans: 90_000 } },
      { id: "3", authorMeta: { name: "nana", fans: 10_000 } },
    ]);

    expect([...groups.keys()].sort()).toEqual(["budi", "nana"]);
    expect(groups.get("nana")).toHaveLength(2);
    expect(groups.get("budi")).toHaveLength(1);
  });

  it("memisahkan objek profil Instagram per username", () => {
    const groups = groupInfluencerDatasetByHandle(
      InfluencerPlatform.INSTAGRAM,
      [
        { username: "nana", followersCount: 10_000, latestPosts: [] },
        { username: "budi", followersCount: 90_000, latestPosts: [] },
      ],
    );

    expect([...groups.keys()].sort()).toEqual(["budi", "nana"]);
  });

  it("menyeragamkan huruf besar-kecil supaya cocok dengan handle tersimpan", () => {
    const groups = groupInfluencerDatasetByHandle(InfluencerPlatform.TIKTOK, [
      { id: "1", authorMeta: { name: "Nana" } },
      { id: "2", authorMeta: { name: "nana" } },
    ]);

    expect([...groups.keys()]).toEqual(["nana"]);
    expect(groups.get("nana")).toHaveLength(2);
  });

  it("membaca bentuk actor cadangan yang memakai channel", () => {
    const groups = groupInfluencerDatasetByHandle(InfluencerPlatform.TIKTOK, [
      { id: "1", channel: { username: "nana" }, postPage: "https://x" },
    ]);

    expect([...groups.keys()]).toEqual(["nana"]);
  });

  it("melewati item tanpa pemilik alih-alih mengarang entri kosong", () => {
    const groups = groupInfluencerDatasetByHandle(InfluencerPlatform.TIKTOK, [
      { id: "1", authorMeta: { name: "nana" } },
      { id: "2" },
      { error: "not found" },
    ]);

    expect([...groups.keys()]).toEqual(["nana"]);
  });
});
