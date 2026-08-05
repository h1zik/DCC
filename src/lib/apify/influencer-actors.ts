import { InfluencerPlatform } from "@prisma/client";

/**
 * Profil influencer hasil parse URL. `handle` selalu lowercase tanpa "@"
 * supaya jadi kunci dedup yang stabil.
 */
export type ParsedInfluencerUrl = {
  platform: InfluencerPlatform;
  handle: string;
  profileUrl: string;
};

/** Path Instagram yang bukan username. */
const IG_RESERVED = new Set([
  "p",
  "reel",
  "reels",
  "tv",
  "stories",
  "explore",
  "accounts",
  "direct",
  "about",
  "developer",
  "legal",
  "privacy",
  "terms",
]);

const HANDLE_RE = /^[A-Za-z0-9._]{1,30}$/;

function cleanHandle(raw: string): string {
  return raw.trim().replace(/^@/, "").replace(/\/+$/, "").toLowerCase();
}

function hostOf(url: URL): string {
  return url.hostname.toLowerCase().replace(/^www\./, "");
}

/**
 * Terima link profil, link post, atau sekadar "@handle".
 *
 * Bila hanya handle yang diberikan (tanpa domain), platform tidak bisa
 * ditebak — pemanggil wajib mengirim `fallbackPlatform`.
 */
export function parseInfluencerUrl(
  input: string,
  fallbackPlatform?: InfluencerPlatform,
): ParsedInfluencerUrl {
  const raw = input.trim();
  if (!raw) {
    throw new Error("Link influencer kosong.");
  }

  // Bentuk "@username" atau "username" polos.
  if (!raw.includes("/") && !raw.includes(".")) {
    const handle = cleanHandle(raw);
    if (!HANDLE_RE.test(handle)) {
      throw new Error(`Username "${raw}" tidak valid.`);
    }
    if (!fallbackPlatform) {
      throw new Error(
        "Pilih platform (Instagram/TikTok) atau tempel link profil lengkap.",
      );
    }
    return {
      platform: fallbackPlatform,
      handle,
      profileUrl: buildProfileUrl(fallbackPlatform, handle),
    };
  }

  let url: URL;
  try {
    url = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
  } catch {
    throw new Error(`Link "${raw}" tidak bisa dibaca.`);
  }

  const host = hostOf(url);
  const segments = url.pathname.split("/").filter(Boolean);

  if (host.includes("instagram.com")) {
    const first = segments[0] ? cleanHandle(segments[0]) : "";
    // Link post/reel: https://instagram.com/p/XXXX — tidak memuat username.
    if (!first || IG_RESERVED.has(first)) {
      throw new Error(
        "Link Instagram itu link post, bukan profil. Tempel link profil seperti https://instagram.com/username",
      );
    }
    if (!HANDLE_RE.test(first)) {
      throw new Error(`Username Instagram "${first}" tidak valid.`);
    }
    return {
      platform: InfluencerPlatform.INSTAGRAM,
      handle: first,
      profileUrl: buildProfileUrl(InfluencerPlatform.INSTAGRAM, first),
    };
  }

  if (host.includes("tiktok.com")) {
    // https://tiktok.com/@user  atau  https://tiktok.com/@user/video/123
    const atSegment = segments.find((s) => s.startsWith("@"));
    if (!atSegment) {
      // vm.tiktok.com/XXXX — short link, perlu di-resolve dulu.
      if (host.startsWith("vm.") || host.startsWith("vt.")) {
        throw new Error(
          "Link pendek TikTok belum didukung. Buka link-nya lalu tempel URL profil lengkap (https://tiktok.com/@username).",
        );
      }
      throw new Error(
        "Link TikTok tidak memuat username. Tempel link profil seperti https://tiktok.com/@username",
      );
    }
    const handle = cleanHandle(atSegment);
    if (!HANDLE_RE.test(handle)) {
      throw new Error(`Username TikTok "${handle}" tidak valid.`);
    }
    return {
      platform: InfluencerPlatform.TIKTOK,
      handle,
      profileUrl: buildProfileUrl(InfluencerPlatform.TIKTOK, handle),
    };
  }

  throw new Error(
    "Hanya link Instagram dan TikTok yang didukung saat ini.",
  );
}

export function buildProfileUrl(
  platform: InfluencerPlatform,
  handle: string,
): string {
  return platform === InfluencerPlatform.INSTAGRAM
    ? `https://www.instagram.com/${handle}/`
    : `https://www.tiktok.com/@${handle}`;
}

export function getInfluencerActorId(platform: InfluencerPlatform): string | null {
  if (platform === InfluencerPlatform.INSTAGRAM) {
    return (
      process.env.APIFY_ACTOR_INSTAGRAM_PROFILE?.trim() ||
      process.env.APIFY_ACTOR_INSTAGRAM?.trim() ||
      "apify~instagram-scraper"
    );
  }
  return (
    process.env.APIFY_ACTOR_TIKTOK_PROFILE?.trim() ||
    process.env.APIFY_ACTOR_TIKTOK_TRENDS?.trim() ||
    "clockworks~tiktok-scraper"
  );
}

export function influencerActorEnvHint(platform: InfluencerPlatform): string {
  return platform === InfluencerPlatform.INSTAGRAM
    ? "Set APIFY_ACTOR_INSTAGRAM (default apify~instagram-scraper)."
    : "Set APIFY_ACTOR_TIKTOK_TRENDS (default clockworks~tiktok-scraper).";
}

/**
 * Jumlah post yang diambil. 12 adalah standar industri untuk hitung ER, tapi
 * lebih banyak post membuat deteksi engagement palsu jauh lebih andal karena
 * varians antar post baru terbaca di sampel besar.
 */
export const DEFAULT_POST_SAMPLE = 24;

/**
 * Panggilan kedua khusus Instagram: tab Reels.
 *
 * Di Instagram, Reels adalah koleksi terpisah dari grid profil — pemilik akun
 * bisa menyembunyikan Reels dari grid, dan hitungan view di `latestPosts`
 * (mode `details`) tidak dapat dipercaya. Hanya mode `reels` yang mengembalikan
 * `videoPlayCount` yang benar untuk seluruh Reels.
 */
export function buildInstagramReelsActorInput(
  handle: string,
  postSample: number = DEFAULT_POST_SAMPLE,
): Record<string, unknown> {
  return {
    directUrls: [buildProfileUrl(InfluencerPlatform.INSTAGRAM, handle)],
    resultsType: "reels",
    resultsLimit: Math.min(Math.max(Math.round(postSample), 6), 100),
    addParentData: false,
  };
}

export function buildInfluencerActorInput(
  platform: InfluencerPlatform,
  handle: string,
  postSample: number = DEFAULT_POST_SAMPLE,
): Record<string, unknown> {
  const limit = Math.min(Math.max(Math.round(postSample), 6), 100);

  if (platform === InfluencerPlatform.INSTAGRAM) {
    return {
      directUrls: [buildProfileUrl(platform, handle)],
      // "details" mengembalikan objek profil (followersCount) + latestPosts.
      // latestPosts adalah GRID profil — bukan Reels. Reels diambil terpisah
      // lewat buildInstagramReelsActorInput.
      resultsType: "details",
      resultsLimit: limit,
      addParentData: false,
      searchLimit: 1,
    };
  }

  return {
    profiles: [handle],
    resultsPerPage: limit,
    profileScrapeSections: ["videos"],
    profileSorting: "latest",
    excludePinnedPosts: true,
    proxyCountryCode: "ID",
    shouldDownloadVideos: false,
    shouldDownloadCovers: false,
    shouldDownloadSubtitles: false,
    shouldDownloadSlideshowImages: false,
    shouldDownloadAvatars: false,
    shouldDownloadMusicCovers: false,
  };
}
