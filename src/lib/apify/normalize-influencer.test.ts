import { describe, expect, it } from "vitest";
import {
  markLeadingPinnedPosts,
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

  it("membedakan like yang disembunyikan dari like nol", () => {
    // Instagram mengembalikan -1 saat pemilik akun menyembunyikan hitungan
    // like. Menyimpannya sebagai 0 membuat akun sehat terlihat mati.
    const [hidden] = normalizeInstagramReels([reelItem({ likesCount: -1 })]);
    expect(hidden.likesHidden).toBe(true);
    expect(hidden.likes).toBe(0);

    const [visible] = normalizeInstagramReels([reelItem({ likesCount: 0 })]);
    expect(visible.likesHidden).toBe(false);
  });

  it("membaca nama field view yang berganti-ganti", () => {
    // Instagram mengganti "plays" jadi "views"; actor ikut berubah nama field.
    const [post] = normalizeInstagramReels([
      reelItem({ videoPlayCount: undefined, videoViewCount: undefined, igPlayCount: 88_000 }),
    ]);
    expect(post.views).toBe(88_000);
  });

  it("ikut mengambil contoh komentar bila terbawa dataset", () => {
    const [post] = normalizeInstagramReels([
      reelItem({
        latestComments: [
          { text: "Kak ini harganya berapa?", ownerUsername: "budi" },
          { text: "🔥🔥", ownerUsername: "sari" },
          { text: "   ", ownerUsername: "kosong" },
        ],
      }),
    ]);
    expect(post.commentSamples).toHaveLength(2);
    expect(post.commentSamples?.[0].author).toBe("budi");
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

  it("mempertahankan komentar dari versi grid saat dataset Reels tidak membawanya", () => {
    // Dataset Reels kerap tanpa komentar. Membuang versi grid begitu saja
    // berarti membuang satu-satunya sampel komentar yang kita punya.
    const feed = {
      ...post("shared", "feed"),
      commentSamples: [{ text: "Kak ini harganya berapa?", author: "budi" }],
    };
    const merged = mergeInstagramSurfaces([feed], [post("shared", "reels", 21_573)]);

    expect(merged[0].views).toBe(21_573);
    expect(merged[0].commentSamples).toHaveLength(1);
  });

  it("memakai jumlah like yang benar-benar terbaca dari salah satu sumber", () => {
    const feed = { ...post("shared", "feed"), likes: 4_200, likesHidden: false };
    const reelHidden = {
      ...post("shared", "reels", 21_573),
      likes: 0,
      likesHidden: true,
    };
    const merged = mergeInstagramSurfaces([feed], [reelHidden]);

    expect(merged[0].likes).toBe(4_200);
    expect(merged[0].likesHidden).toBe(false);
  });
});

/**
 * Bentuk nyata `apidojo/tiktok-profile-scraper` — actor cadangan yang dipakai
 * saat clockworks pulang tanpa video. Fixture ini disalin dari keluaran run
 * sungguhan, bukan dikarang.
 */
describe("normalizeTikTokProfile — bentuk actor cadangan", () => {
  function apidojoItem(overrides: Record<string, unknown> = {}) {
    return {
      inputSource: "akhzalswan16",
      id: "7670486784152784136",
      title: "jujur ini pertama kalinya ke Bromo",
      views: 92_676,
      likes: 20_288,
      comments: 181,
      shares: 317,
      bookmarks: 274,
      uploadedAt: 1_770_285_986,
      uploadedAtFormatted: "2026-08-05T10:06:26.000Z",
      postPage: "https://www.tiktok.com/@akhzalswan16/video/7670486784152784136",
      video: { cover: "https://p16.tiktokcdn.com/cover.heic" },
      channel: {
        username: "akhzalswan16",
        name: "Panggil aja Aksal",
        bio: "duArr~",
        avatar: "https://p16.tiktokcdn.com/avatar.heic",
        verified: true,
        followers: 632_380,
        following: 159,
        videos: 979,
      },
      ...overrides,
    };
  }

  it("mengenali bentuknya dari data, bukan dari actor mana yang dipanggil", () => {
    const profile = normalizeTikTokProfile([apidojoItem()], "akhzalswan16");

    expect(profile.followers).toBe(632_380);
    expect(profile.following).toBe(159);
    expect(profile.postCount).toBe(979);
    expect(profile.displayName).toBe("Panggil aja Aksal");
    expect(profile.isVerified).toBe(true);
  });

  it("memetakan nama field yang sama sekali berbeda dari clockworks", () => {
    const [post] = normalizeTikTokProfile([apidojoItem()], "x").posts;

    expect(post.likes).toBe(20_288);
    expect(post.comments).toBe(181);
    expect(post.shares).toBe(317);
    expect(post.views).toBe(92_676);
    // `bookmarks` di actor ini = simpan/collect di clockworks.
    expect(post.saves).toBe(274);
    expect(post.surface).toBe("reels");
    expect(post.postedAt?.toISOString()).toBe("2026-08-05T10:06:26.000Z");
    expect(post.url).toContain("/video/7670486784152784136");
  });

  it("menandai video yang dipin dari urutannya", () => {
    // TikTok menaruh video pin di paling atas profil; actor ini tidak
    // menandainya, dan tanpa deteksi urutan video pin lama ikut terhitung
    // sebagai post terbaru.
    const profile = normalizeTikTokProfile(
      [
        apidojoItem({ id: "pin1", uploadedAtFormatted: "2026-01-23T10:10:12.000Z" }),
        apidojoItem({ id: "pin2", uploadedAtFormatted: "2025-09-22T08:30:17.000Z" }),
        apidojoItem({ id: "baru1", uploadedAtFormatted: "2026-08-05T10:06:26.000Z" }),
        apidojoItem({ id: "baru2", uploadedAtFormatted: "2026-08-04T09:01:48.000Z" }),
      ],
      "x",
    );

    expect(profile.posts.map((p) => p.isPinned)).toEqual([
      true,
      true,
      false,
      false,
    ]);
  });

  it("tidak menandai apa pun pada profil yang urut menurun", () => {
    const profile = normalizeTikTokProfile(
      [
        apidojoItem({ id: "a", uploadedAtFormatted: "2026-08-05T10:00:00.000Z" }),
        apidojoItem({ id: "b", uploadedAtFormatted: "2026-08-04T10:00:00.000Z" }),
        apidojoItem({ id: "c", uploadedAtFormatted: "2026-08-03T10:00:00.000Z" }),
      ],
      "x",
    );

    expect(profile.posts.every((p) => !p.isPinned)).toBe(true);
  });

  it("tidak menandai lebih dari tiga pin — itu batas TikTok", () => {
    const posts = Array.from({ length: 5 }, (_, i) => ({
      externalId: `p${i}`,
      likes: 1,
      comments: 1,
      shares: 0,
      views: 10,
      saves: 0,
      surface: "reels" as const,
      // Empat post pertama lebih tua daripada yang terakhir.
      postedAt: new Date(
        i === 4 ? "2026-08-05T00:00:00Z" : `2025-0${i + 1}-01T00:00:00Z`,
      ),
    }));

    expect(
      markLeadingPinnedPosts(posts).filter((p) => p.isPinned),
    ).toHaveLength(3);
  });

  it("menolak dataset kosong dengan pesan yang jelas", () => {
    expect(() => normalizeTikTokProfile([], "x")).toThrow(/tidak mengembalikan/i);
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
