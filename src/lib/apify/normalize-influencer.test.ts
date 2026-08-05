import { describe, expect, it } from "vitest";
import {
  mergeInstagramSurfaces,
  normalizeInstagramProfile,
  normalizeInstagramReels,
  normalizeTikTokProfile,
  type NormalizedInfluencerPost,
} from "@/lib/apify/normalize-influencer";

/** Bentuk item nyata dari `resultsType: "reels"`. */
function reelItem(overrides: Record<string, unknown> = {}) {
  return {
    id: "3812",
    shortCode: "DZ7RDCNv6GA",
    type: "Video",
    productType: "clips",
    caption: "konten baru",
    url: "https://www.instagram.com/reel/DZ7RDCNv6GA/",
    likesCount: 77,
    commentsCount: 3,
    videoPlayCount: 21573,
    videoViewCount: 21573,
    timestamp: "2026-06-23T10:00:00.000Z",
    displayUrl: "https://scontent.cdninstagram.com/x.jpg",
    paidPartnership: false,
    isPinned: false,
    ...overrides,
  };
}

describe("normalizeInstagramReels", () => {
  it("reads play counts that the profile grid never provides", () => {
    const [post] = normalizeInstagramReels([reelItem()]);
    expect(post.views).toBe(21573);
    expect(post.likes).toBe(77);
    expect(post.comments).toBe(3);
    expect(post.surface).toBe("reels");
  });

  it("reads the real paidPartnership field", () => {
    // Field-nya bernama `paidPartnership` — bukan isSponsored/isPaidPartnership.
    // Sebelumnya label resmi Instagram tidak pernah tertangkap.
    const [post] = normalizeInstagramReels([
      reelItem({ paidPartnership: true, caption: "tanpa hashtag apa pun" }),
    ]);
    expect(post.isSponsoredMeta).toBe(true);
  });

  it("marks pinned reels so they can be dropped from the sample", () => {
    const [post] = normalizeInstagramReels([reelItem({ isPinned: true })]);
    expect(post.isPinned).toBe(true);
  });

  it("skips items without an identifier", () => {
    const posts = normalizeInstagramReels([
      { likesCount: 10 },
      reelItem(),
    ] as Record<string, unknown>[]);
    expect(posts).toHaveLength(1);
  });
});

describe("normalizeInstagramProfile", () => {
  function profileItem(latestPosts: Record<string, unknown>[]) {
    return {
      username: "someone",
      fullName: "Some One",
      followersCount: 49_667,
      followsCount: 800,
      postsCount: 300,
      verified: false,
      private: false,
      latestPosts,
    };
  }

  it("tags grid posts as feed", () => {
    const profile = normalizeInstagramProfile(
      [profileItem([{ id: "1", type: "Sidecar", likesCount: 1600, commentsCount: 45 }])],
      "someone",
    );
    expect(profile.posts[0].surface).toBe("feed");
    expect(profile.followers).toBe(49_667);
  });

  it("still recognises a Reel that appears inside the grid", () => {
    // productType "clips" menandai Reels sungguhan walau datang dari grid.
    const profile = normalizeInstagramProfile(
      [profileItem([{ id: "1", type: "Video", productType: "clips", likesCount: 90 }])],
      "someone",
    );
    expect(profile.posts[0].surface).toBe("reels");
  });

  it("refuses private accounts rather than reporting empty engagement", () => {
    expect(() =>
      normalizeInstagramProfile(
        [{ username: "someone", private: true, latestPosts: [] }],
        "someone",
      ),
    ).toThrow(/privat/i);
  });
});

describe("mergeInstagramSurfaces", () => {
  function post(
    id: string,
    surface: NormalizedInfluencerPost["surface"],
    views = 0,
  ): NormalizedInfluencerPost {
    return {
      externalId: id,
      likes: 10,
      comments: 1,
      shares: 0,
      views,
      saves: 0,
      surface,
    };
  }

  it("keeps both collections", () => {
    const merged = mergeInstagramSurfaces(
      [post("a", "feed"), post("b", "feed")],
      [post("c", "reels", 5000)],
    );
    expect(merged).toHaveLength(3);
  });

  it("prefers the Reels copy when a Reel also shows in the grid", () => {
    // Versi grid melaporkan view yang tidak dapat dipercaya (di sini 0);
    // versi dari tab Reels yang harus menang.
    const merged = mergeInstagramSurfaces(
      [post("shared", "feed", 0)],
      [post("shared", "reels", 21573)],
    );
    expect(merged).toHaveLength(1);
    expect(merged[0].views).toBe(21573);
    expect(merged[0].surface).toBe("reels");
  });

  it("handles an empty Reels result", () => {
    const merged = mergeInstagramSurfaces([post("a", "feed")], []);
    expect(merged).toHaveLength(1);
  });
});

describe("normalizeTikTokProfile", () => {
  it("treats every TikTok video as a reel surface", () => {
    const profile = normalizeTikTokProfile(
      [
        {
          id: "7300",
          webVideoUrl: "https://www.tiktok.com/@x/video/7300",
          text: "halo",
          diggCount: 100,
          commentCount: 5,
          shareCount: 2,
          playCount: 9000,
          collectCount: 1,
          createTimeISO: "2026-07-01T00:00:00.000Z",
          authorMeta: { name: "x", fans: 68_700, following: 100, video: 200 },
        },
      ],
      "x",
    );
    expect(profile.posts[0].surface).toBe("reels");
    expect(profile.posts[0].views).toBe(9000);
    expect(profile.followers).toBe(68_700);
  });
});
