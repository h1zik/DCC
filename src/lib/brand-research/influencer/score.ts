import {
  InfluencerPlatform,
  InfluencerTier,
  InfluencerVerdict,
} from "@prisma/client";
import type {
  NormalizedInfluencerPost,
  PostSurface,
} from "@/lib/apify/normalize-influencer";
import { isSponsoredPost } from "@/lib/brand-research/influencer/sponsored";
import {
  scanBrandSafety,
  type BrandSafetyResult,
} from "@/lib/brand-research/influencer/brand-safety";
import {
  analyzeCommentQuality,
  type CommentQualityResult,
} from "@/lib/brand-research/influencer/comment-quality";

export type FakeFlagSeverity = "high" | "medium" | "low";

/**
 * Apa yang sebenarnya dipertanyakan oleh sebuah sinyal.
 *
 * Pemisahan ini penting: akun foto Instagram tanpa data view bukanlah akun
 * yang tidak asli — itu keterbatasan data. Menghukum skor keaslian karenanya
 * membuat penilaian salah.
 */
export type FlagImpact = "authenticity" | "performance" | "data" | "brandSafety";

export type InfluencerFakeFlag = {
  code: string;
  severity: FakeFlagSeverity;
  impact: FlagImpact;
  label: string;
  detail: string;
  /** Poin yang dikurangi dari skor keaslian (authenticity) atau performa. */
  penalty: number;
};

export type SponsoredSplit = {
  sponsoredCount: number;
  organicCount: number;
  /** ER standar khusus post berbayar. Null bila sampelnya tidak cukup. */
  sponsoredEr: number | null;
  organicEr: number | null;
  /** Selisih ER berbayar terhadap organik, persen. Negatif = turun. */
  deltaPct: number | null;
};

export type SampleConfidence = "high" | "medium" | "low";

/**
 * Angka satu permukaan konten (grid feed atau Reels), dihitung terpisah.
 *
 * Inilah unit yang sebenarnya dibeli brand: yang dipesan adalah "satu Reels"
 * atau "satu post feed", bukan "rata-rata akun". Menggabungkan keduanya jadi
 * satu angka menyembunyikan justru informasi yang menentukan pesanan.
 */
export type SurfaceStats = {
  surface: PostSurface;
  postCount: number;
  /** Post yang benar-benar bisa dihitung (like tidak disembunyikan). */
  measuredCount: number;
  medianLikes: number;
  medianComments: number;
  /** ER standar (like + komentar) ÷ follower untuk permukaan ini. */
  engagementRate: number | null;
  erVsBenchmark: number | null;
  engagementCv: number | null;
  sponsored: SponsoredSplit;
};

export type InfluencerScoreInput = {
  platform: InfluencerPlatform;
  followers: number;
  following: number;
  posts: NormalizedInfluencerPost[];
  /** Disuntik di test supaya perhitungan "hari sejak posting" deterministik. */
  now?: Date;
};

export type InfluencerScoreResult = {
  tier: InfluencerTier;
  benchmarkEr: number;

  postsFetched: number;
  postsAnalyzed: number;
  /** Rentang hari yang dicakup sampel. */
  sampleWindowDays: number | null;
  confidence: SampleConfidence;

  // Median = angka utama (tahan outlier viral). Mean disimpan untuk pembanding.
  medianLikes: number;
  medianComments: number;
  medianShares: number;
  medianViews: number;
  avgLikes: number;
  avgComments: number;
  avgShares: number;
  avgViews: number;

  /**
   * ER standar: (like + komentar) / follower, dihitung pada PERMUKAAN UTAMA —
   * format terkuat yang benar-benar bisa dipesan brand. Definisi yang dipakai
   * tabel median industri, jadi hanya angka INI yang boleh dibandingkan ke
   * benchmark.
   */
  engagementRate: number;
  /** ER termasuk share & simpan — nilai penuh bagi brand, tapi tak sebanding benchmark. */
  totalEngagementRate: number;
  viewEngagementRate: number | null;
  viewRate: number | null;

  /** Jumlah post per permukaan. Di TikTok semuanya masuk reels. */
  feedPostCount: number;
  reelsPostCount: number;
  /**
   * ER standar tiap permukaan terhadap follower — dihitung dengan definisi yang
   * sama persis sehingga keduanya boleh dibandingkan langsung.
   */
  feedEngagementRate: number | null;
  reelsEngagementRate: number | null;
  /** Permukaan yang jadi dasar `engagementRate` dan komponen engagement. */
  primarySurface: PostSurface | null;
  surfaces: SurfaceStats[];

  postsPerWeek: number;
  daysSinceLastPost: number | null;

  score: number;
  verdict: InfluencerVerdict;
  authenticityScore: number;
  fakeFlags: InfluencerFakeFlag[];
  sponsored: SponsoredSplit;
  brandSafety: BrandSafetyResult;
  commentQuality: CommentQualityResult | null;

  metrics: {
    erVsBenchmark: number;
    commentLikeRatio: number | null;
    engagementCv: number | null;
    engagementTrendPct: number | null;
    followingRatio: number | null;
    /** mean ÷ median interaksi. Di atas 2 = beberapa post viral mendominasi. */
    viralSkew: number | null;
    /** Bagian post sampel yang punya hitungan view (0–1). */
    viewCoverage: number | null;
    viewSampleCount: number;
    /** Apakah data view cukup lengkap untuk dipercaya sebagai jangkauan. */
    viewDataRepresentative: boolean;
    /** Jumlah sinyal keaslian berat — 2 atau lebih baru jadi SUSPICIOUS. */
    highAuthenticityFlags: number;
    /**
     * Perkiraan ER yang akan didapat brand bila memasang campaign — memakai
     * ER post berbayar bila sampelnya memadai, kalau tidak jatuh ke ER umum.
     */
    expectedCampaignEr: number;
    expectedCampaignErSource: "sponsored" | "overall";
    primarySurface: PostSurface | null;
    feedEngagementRate: number | null;
    reelsEngagementRate: number | null;
    /** Selisih ER permukaan terkuat terhadap yang terlemah, persen. */
    surfaceGapPct: number | null;
    /**
     * Ada setidaknya satu post yang angkanya bisa dihitung. Bila false, seluruh
     * angka ER di hasil ini nol karena TIDAK TERUKUR — bukan karena nol.
     */
    engagementMeasurable: boolean;
    /** Post yang like-nya disembunyikan pemilik akun — angkanya diperkirakan. */
    hiddenLikePosts: number;
    /** Porsi post permukaan utama yang like-nya disembunyikan (0–1). */
    hiddenLikeShare: number;
    /** Post berbayar yang like-nya disembunyikan. */
    hiddenSponsoredPosts: number;
    /**
     * ER yang dipakai MENILAI, dengan like tersembunyi diperkirakan dari
     * komentar. Sama dengan `engagementRate` bila tidak ada yang disembunyikan.
     */
    imputedEngagementRate: number;
    /**
     * Rasio komentar-terhadap-like yang dipakai memperkirakan. Bila
     * `commentLikeRatio` null, ini angka umum — perkiraannya jauh lebih longgar.
     */
    imputationRatio: number;
    /** Komponen engagement bersandar pada perkiraan, bukan angka terukur. */
    engagementImputed: boolean;
    /** Bagian post sampel yang terdeteksi berbayar (0–1), seluruh permukaan. */
    sponsoredShare: number;
    sponsoredCountAllSurfaces: number;
    brandSafetyWorstSeverity: FakeFlagSeverity | null;
    /** Disimpan utuh agar UI bisa menautkan post yang perlu diperiksa manual. */
    brandSafety: BrandSafetyResult;
    commentQuality: CommentQualityResult | null;
    components: {
      engagement: number;
      consistency: number;
      reach: number;
      authenticity: number;
      performancePenalty: number;
    };
  };
};

const TIER_FLOOR: { tier: InfluencerTier; min: number }[] = [
  { tier: InfluencerTier.MEGA, min: 1_000_000 },
  { tier: InfluencerTier.MACRO, min: 500_000 },
  { tier: InfluencerTier.MID, min: 100_000 },
  { tier: InfluencerTier.MICRO, min: 10_000 },
  { tier: InfluencerTier.NANO, min: 0 },
];

export function resolveTier(followers: number): InfluencerTier {
  return (
    TIER_FLOOR.find((t) => followers >= t.min)?.tier ?? InfluencerTier.NANO
  );
}

export const TIER_LABEL: Record<InfluencerTier, string> = {
  NANO: "Nano (<10rb)",
  MICRO: "Micro (10rb–100rb)",
  MID: "Mid (100rb–500rb)",
  MACRO: "Macro (500rb–1jt)",
  MEGA: "Mega (>1jt)",
};

export const SURFACE_LABEL: Record<PostSurface, string> = {
  feed: "Feed",
  reels: "Reels",
};

/**
 * ER acuan per tier, dalam persen terhadap follower, memakai definisi
 * (like + komentar) — sama dengan `engagementRate` di atas.
 *
 * Dipisah per platform karena TikTok secara struktural jauh lebih tinggi:
 * feed-nya berbasis rekomendasi, bukan graf follower, sehingga satu video bisa
 * menjangkau jauh melebihi jumlah follower.
 *
 * KALIBRASI: angka ini adalah default yang masuk akal, bukan hasil hitung dari
 * dataset tertentu. Sesuaikan begitu ada data kampanye sendiri.
 */
const BENCHMARK_ER: Record<InfluencerPlatform, Record<InfluencerTier, number>> = {
  INSTAGRAM: { NANO: 3.5, MICRO: 2.2, MID: 1.5, MACRO: 1.2, MEGA: 0.9 },
  TIKTOK: { NANO: 12, MICRO: 9, MID: 7, MACRO: 5.5, MEGA: 4 },
};

export function benchmarkErFor(
  platform: InfluencerPlatform,
  tier: InfluencerTier,
): number {
  return BENCHMARK_ER[platform][tier];
}

/**
 * View rate (view ÷ follower, persen) yang dianggap jangkauan penuh.
 *
 * Dipisah per platform dengan alasan yang sama seperti benchmark ER: di TikTok
 * seluruh konten didorong algoritma sehingga view kerap melampaui jumlah
 * follower, sementara Reels Instagram jarang setinggi itu. Memakai satu target
 * untuk keduanya akan membuat semua akun Instagram terlihat berjangkauan buruk.
 *
 * KALIBRASI: default yang masuk akal, belum dihitung dari dataset tertentu.
 */
const REACH_TARGET: Record<InfluencerPlatform, number> = {
  INSTAGRAM: 20,
  TIKTOK: 30,
};

/**
 * Ambang "komentar terlalu sedikit dibanding like", per tier.
 *
 * Rasio komentar turun secara alami seiring besarnya akun: audiens mega jauh
 * lebih pasif daripada audiens nano yang saling kenal. Satu ambang untuk semua
 * tier akan menuduh hampir setiap akun besar membeli like.
 */
const COMMENT_RATIO_FLOOR: Record<InfluencerTier, number> = {
  NANO: 0.004,
  MICRO: 0.004,
  MID: 0.004,
  MACRO: 0.003,
  MEGA: 0.002,
};

const AUTHENTICITY_PENALTY: Record<FakeFlagSeverity, number> = {
  high: 30,
  medium: 18,
  low: 8,
};

const PERFORMANCE_PENALTY: Record<FakeFlagSeverity, number> = {
  high: 20,
  medium: 12,
  low: 5,
};

const DAY_MS = 86_400_000;

/**
 * Post lebih lama dari ini dibuang dari sampel: engagement setahun lalu tidak
 * memprediksi hasil kampanye bulan depan.
 */
const SAMPLE_WINDOW_DAYS = 180;
/** Di bawah ini, angka ER belum layak dipercaya. */
const MIN_SAMPLE = 6;
/** Sampel minimal per sisi agar perbandingan berbayar vs organik bermakna. */
const MIN_SPLIT_SAMPLE = 2;
/**
 * Post minimal pada satu permukaan sebelum permukaan itu boleh jadi dasar
 * angka utama. Dua Reels bagus di antara dua puluh post feed lemah belum cukup
 * jadi janji.
 */
const MIN_SURFACE_SAMPLE = 3;
/** Sampel minimal sebelum rasio komentar boleh dipakai menuduh. */
const MIN_RATIO_SAMPLE = 4;

/**
 * Rasio komentar-terhadap-like yang dipakai memperkirakan like tersembunyi
 * saat akun tidak menyisakan satu pun post terukur untuk mengukur rasionya
 * sendiri. 3% adalah titik tengah rentang sehat 1–5%.
 */
const FALLBACK_COMMENT_LIKE_RATIO = 0.03;
/**
 * Batas rasio yang boleh dipakai memperkirakan. Di luar rentang ini
 * perkiraannya meledak: rasio 0,1% mengubah 40 komentar jadi 40.000 like.
 */
const IMPUTE_RATIO_MIN = 0.005;
const IMPUTE_RATIO_MAX = 0.2;
/**
 * Bobot perkiraan saat rasio komentar akun ini sendiri TIDAK diketahui, yaitu
 * ketika seluruh like disembunyikan.
 *
 * Rasio komentar antar akun berbeda beberapa kali lipat, jadi perkiraan yang
 * berpijak pada angka umum tidak boleh menggerakkan skor sejauh perkiraan yang
 * berpijak pada perilaku akun itu sendiri. Sisa bobotnya ditarik ke netral —
 * mengakui bahwa kita memang tidak tahu.
 *
 * Sengaja dibuat tinggi. Tiap poin yang ditarik ke netral adalah hadiah bagi
 * akun berperforma buruk yang menyembunyikan like, dan ketidakpastian sudah
 * disampaikan lewat jalur yang tidak membelokkan skor: keyakinan turun, vonis
 * tertinggi ditahan, dan flag-nya meminta screenshot Insights. Menyisakan
 * sedikit tarikan ke netral hanya untuk menjaga agar akun yang audiensnya
 * memang pendiam tidak jatuh terlalu dalam gara-gara rasio umum yang meleset.
 */
const GENERIC_IMPUTE_WEIGHT = 0.8;
/** Nilai komponen engagement saat tidak ada dasar sama sekali untuk menilai. */
const NEUTRAL_ENGAGEMENT = 60;
/**
 * Plafon komponen engagement saat SELURUH angkanya diperkirakan.
 *
 * Perkiraan punya rentang salah yang lebar, dan nilai tertinggi harus menuntut
 * bukti. Plafonnya melandai sesuai porsi data yang diperkirakan: satu post
 * tersembunyi dari dua puluh nyaris tidak mengubah apa pun.
 */
const IMPUTED_ENGAGEMENT_CEILING = 75;
/** Di atas porsi ini, angka engagement lebih banyak diperkirakan daripada diukur. */
const HIDDEN_SHARE_LOW_CONFIDENCE = 0.6;
/** Di atas porsi ini, keyakinan tidak boleh lagi "tinggi". */
const HIDDEN_SHARE_MEDIUM_CONFIDENCE = 0.3;
/**
 * Selisih kekerapan sebelum "post berbayar lebih sering disembunyikan" boleh
 * disebut pola, bukan kebetulan.
 */
const SPONSORED_HIDING_MULTIPLE = 2;

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const variance =
    values.reduce((sum, v) => sum + (v - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function round(value: number, digits = 2): number {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** like + komentar — definisi yang sebanding dengan tabel median industri. */
function standardInteractions(post: NormalizedInfluencerPost): number {
  return post.likes + post.comments;
}

/** Seluruh interaksi bernilai bagi brand, termasuk share & simpan. */
function totalInteractions(post: NormalizedInfluencerPost): number {
  return post.likes + post.comments + post.shares + post.saves;
}

/**
 * Post yang angkanya benar-benar terukur.
 *
 * Instagram mengembalikan -1 saat pemilik akun menyembunyikan jumlah like.
 * Menghitungnya sebagai nol membuat akun yang sehat terlihat mati, jadi post
 * seperti itu dikeluarkan dari perhitungan engagement — bukan dianggap nol.
 */
function isMeasurable(post: NormalizedInfluencerPost): boolean {
  return post.likesHidden !== true;
}

/**
 * Skor 0-100 dari rasio ER terhadap acuan tier. Kurva melandai di atas 1×:
 * menyamai median sudah layak (70), untuk 100 harus dua kali lipat median.
 */
function scoreFromRatio(ratio: number): number {
  if (ratio <= 0) return 0;
  if (ratio >= 2) return 100;
  if (ratio >= 1) return 70 + (ratio - 1) * 30;
  return ratio * 70;
}

/** Ritme posting: 2-7 post/minggu dianggap ideal untuk kerja sama berbayar. */
function scoreCadence(postsPerWeek: number): number {
  if (postsPerWeek <= 0) return 0;
  if (postsPerWeek < 0.5) return 25;
  if (postsPerWeek < 1) return 50;
  if (postsPerWeek <= 7) return 100;
  if (postsPerWeek <= 14) return 85;
  // Sangat sering biasanya berarti konten massal berkualitas rendah.
  return 65;
}

function scoreRecency(daysSinceLastPost: number | null): number {
  if (daysSinceLastPost === null) return 60;
  if (daysSinceLastPost <= 7) return 100;
  if (daysSinceLastPost <= 14) return 85;
  if (daysSinceLastPost <= 30) return 65;
  if (daysSinceLastPost <= 60) return 35;
  return 10;
}

/**
 * Pilih post yang layak dianalisis.
 *
 * Membatasi ke jendela 180 hari juga menyingkirkan post yang dipin — di
 * Instagram post pin ikut terbawa di daftar terbaru dan bisa berumur tahunan.
 */
export function selectSample(
  posts: NormalizedInfluencerPost[],
  now: Date,
): NormalizedInfluencerPost[] {
  // Post yang dipin bisa berumur tahunan dan merusak baik ritme posting maupun
  // rata-rata engagement. Instagram mengekspos penandanya, jadi dibuang lebih
  // dulu — kecuali kalau setelah dibuang tidak ada post tersisa.
  const unpinned = posts.filter((p) => !p.isPinned);
  const pool = unpinned.length > 0 ? unpinned : posts;

  const sorted = [...pool].sort((a, b) => {
    const at = a.postedAt?.getTime() ?? 0;
    const bt = b.postedAt?.getTime() ?? 0;
    return bt - at;
  });

  const dated = sorted.filter((p) => p.postedAt);
  if (dated.length === 0) return sorted;

  const cutoff = now.getTime() - SAMPLE_WINDOW_DAYS * DAY_MS;
  const recent = dated.filter((p) => (p.postedAt as Date).getTime() >= cutoff);

  // Kalau post terbaru saja belum cukup banyak, lebih baik memakai semuanya
  // dan menurunkan tingkat keyakinan daripada menolak menilai sama sekali.
  return recent.length >= MIN_SAMPLE ? recent : sorted;
}

/**
 * Ritme posting dari MEDIAN jarak antar-post, bukan dari rentang ujung ke
 * ujung. Satu post lama yang ikut terbawa tidak lagi menghancurkan angkanya.
 */
function computeCadence(sample: NormalizedInfluencerPost[]): number {
  const timestamps = sample
    .map((p) => p.postedAt?.getTime())
    .filter((t): t is number => typeof t === "number")
    .sort((a, b) => b - a);

  if (timestamps.length < 2) return 0;

  const gapsInDays: number[] = [];
  for (let i = 0; i < timestamps.length - 1; i += 1) {
    const gap = (timestamps[i] - timestamps[i + 1]) / DAY_MS;
    if (gap > 0) gapsInDays.push(gap);
  }
  if (gapsInDays.length === 0) return 0;

  const medianGap = median(gapsInDays);
  return medianGap > 0 ? 7 / medianGap : 0;
}

function computeSponsoredSplit(
  sample: NormalizedInfluencerPost[],
  followers: number,
): SponsoredSplit {
  const sponsored = sample.filter((p) => isSponsoredPost(p));
  const organic = sample.filter((p) => !isSponsoredPost(p));

  const erOf = (posts: NormalizedInfluencerPost[]): number | null => {
    if (posts.length < MIN_SPLIT_SAMPLE || followers <= 0) return null;
    return round(
      (median(posts.map(standardInteractions)) / followers) * 100,
      3,
    );
  };

  const sponsoredEr = erOf(sponsored);
  const organicEr = erOf(organic);
  const deltaPct =
    sponsoredEr !== null && organicEr !== null && organicEr > 0
      ? round(((sponsoredEr - organicEr) / organicEr) * 100, 1)
      : null;

  return {
    sponsoredCount: sponsored.length,
    organicCount: organic.length,
    sponsoredEr,
    organicEr,
    deltaPct,
  };
}

/**
 * Hitung angka satu permukaan dari post-nya sendiri.
 *
 * Semua permukaan memakai definisi ER yang persis sama, sehingga ER feed dan
 * ER Reels boleh dibandingkan langsung — itulah inti pemisahan ini.
 */
function buildSurfaceStats(
  surface: PostSurface,
  posts: NormalizedInfluencerPost[],
  followers: number,
  benchmarkEr: number,
): SurfaceStats {
  const measured = posts.filter(isMeasurable);
  const totals = measured.map(totalInteractions);
  const meanTotal = mean(totals);
  const engagementRate =
    measured.length > 0 && followers > 0
      ? round((median(measured.map(standardInteractions)) / followers) * 100, 3)
      : null;

  return {
    surface,
    postCount: posts.length,
    measuredCount: measured.length,
    medianLikes: round(median(measured.map((p) => p.likes))),
    medianComments: round(median(measured.map((p) => p.comments))),
    engagementRate,
    erVsBenchmark:
      engagementRate !== null && benchmarkEr > 0
        ? round(engagementRate / benchmarkEr, 2)
        : null,
    engagementCv:
      measured.length >= 2 && meanTotal > 0
        ? round(stdDev(totals) / meanTotal, 3)
        : null,
    sponsored: computeSponsoredSplit(measured, followers),
  };
}

/**
 * Rasio komentar-terhadap-like sebagai NILAI TENGAH antar post, bukan total
 * dibagi total.
 *
 * Satu post giveaway dengan puluhan ribu komentar bisa menyeret rasio total ke
 * atas 20% dan memicu tuduhan "engagement pod" pada akun yang sepenuhnya
 * wajar. Median tidak bisa digeser satu post.
 */
function medianCommentLikeRatio(
  posts: NormalizedInfluencerPost[],
): { ratio: number | null; sampleSize: number } {
  const ratios = posts
    .filter((p) => isMeasurable(p) && p.likes > 0)
    .map((p) => p.comments / p.likes);
  return {
    ratio: ratios.length >= MIN_RATIO_SAMPLE ? median(ratios) : null,
    sampleSize: ratios.length,
  };
}

/**
 * Rasio yang dipakai memperkirakan like tersembunyi — rasio akun itu sendiri
 * bila terukur, kalau tidak angka umum. Dijepit ke rentang wajar supaya akun
 * dengan rasio ekstrem tidak menghasilkan perkiraan yang mustahil.
 */
function imputationRatioFor(observed: number | null): number {
  return clamp(
    observed ?? FALLBACK_COMMENT_LIKE_RATIO,
    IMPUTE_RATIO_MIN,
    IMPUTE_RATIO_MAX,
  );
}

/**
 * Interaksi standar dengan like tersembunyi diganti perkiraan dari komentar.
 *
 * Menyembunyikan like TIDAK menghapus seluruh data: jumlah komentar tetap
 * publik, dan rasio komentar-terhadap-like sebuah akun cukup stabil antar
 * post. Jadi komentar bisa dipakai memperkirakan like yang hilang.
 *
 * Ini menutup dua celah sekaligus. Menganggap like tersembunyi sebagai nol
 * membuat akun sehat terlihat mati; memberi nilai netral membuat akun lemah
 * dapat nilai gratis — dan karena engagement berbobot 45%, nilai netral itu
 * justru MENGUNTUNGKAN akun yang performanya buruk. Perkiraan mengembalikan
 * penilaian ke level akun yang sebenarnya, ke arah mana pun itu.
 */
function imputedStandardInteractions(
  post: NormalizedInfluencerPost,
  ratio: number,
): number {
  if (!post.likesHidden) return standardInteractions(post);
  return post.comments / ratio + post.comments;
}

/**
 * Keyakinan ditentukan oleh sampel yang benar-benar menghasilkan angka
 * engagement, bukan sekadar total post.
 *
 * Akun Instagram bisa punya 28 post terambil tapi hanya 4 di antaranya ada di
 * permukaan utama — dan ER dihitung dari 4 itu. Memakai total post akan
 * melaporkan "keyakinan tinggi" untuk angka yang sebenarnya rapuh.
 *
 * Porsi post yang like-nya disembunyikan ikut menentukan. Sampel 20 post yang
 * separuhnya disembunyikan tetap menyisakan 10 post terukur — cukup untuk
 * lolos ambang jumlah, padahal separuh datanya adalah perkiraan.
 */
function resolveConfidence(
  postsAnalyzed: number,
  engagementSampleSize: number,
  sampleWindowDays: number | null,
  hiddenShare: number,
): SampleConfidence {
  if (postsAnalyzed < MIN_SAMPLE || engagementSampleSize < MIN_SAMPLE) {
    return "low";
  }
  if (sampleWindowDays !== null && sampleWindowDays > SAMPLE_WINDOW_DAYS) {
    return "low";
  }
  if (hiddenShare > HIDDEN_SHARE_LOW_CONFIDENCE) return "low";
  if (hiddenShare > HIDDEN_SHARE_MEDIUM_CONFIDENCE) return "medium";
  if (postsAnalyzed >= 10 && engagementSampleSize >= 10) return "high";
  return "medium";
}

function detectSignals(params: {
  platform: InfluencerPlatform;
  tier: InfluencerTier;
  followers: number;
  following: number;
  postsAnalyzed: number;
  /** Jumlah post di permukaan utama yang menghasilkan angka engagement. */
  engagementSampleSize: number;
  engagementMeasurable: boolean;
  hiddenLikePosts: number;
  /** Porsi post permukaan utama yang like-nya disembunyikan (0–1). */
  hiddenShare: number;
  /** Post berbayar di sampel yang like-nya disembunyikan. */
  hiddenSponsoredPosts: number;
  /** Porsi post berbayar yang disembunyikan (0–1). */
  hiddenSponsoredShare: number;
  /** Porsi post organik yang disembunyikan (0–1) — pembanding kekerapan. */
  hiddenOrganicShare: number;
  sampleWindowDays: number | null;
  commentLikeRatio: number | null;
  commentRatioSampleSize: number;
  /** Permukaan yang engagement-nya terlalu seragam untuk ukuran sampelnya. */
  flatSurfaces: SurfaceStats[];
  /** Ada permukaan lain dengan sampel memadai yang variasinya wajar. */
  hasVariedSurface: boolean;
  viralSkew: number | null;
  viewRate: number | null;
  /** Bagian post sampel yang punya hitungan view (0–1). */
  viewCoverage: number | null;
  viewDataRepresentative: boolean;
  reelsPostCount: number;
  erVsBenchmark: number;
  daysSinceLastPost: number | null;
  sponsored: SponsoredSplit;
  sponsoredShare: number;
  sponsoredCountAllSurfaces: number;
  primarySurface: PostSurface | null;
  surfaceGapPct: number | null;
  weakestSurface: SurfaceStats | null;
  commentQuality: CommentQualityResult | null;
  brandSafety: BrandSafetyResult;
}): InfluencerFakeFlag[] {
  const flags: InfluencerFakeFlag[] = [];
  const {
    platform,
    tier,
    followers,
    following,
    postsAnalyzed,
    engagementSampleSize,
    engagementMeasurable,
    hiddenLikePosts,
    hiddenShare,
    hiddenSponsoredPosts,
    hiddenSponsoredShare,
    hiddenOrganicShare,
    sampleWindowDays,
    commentLikeRatio,
    commentRatioSampleSize,
    flatSurfaces,
    hasVariedSurface,
    viralSkew,
    viewRate,
    viewCoverage,
    viewDataRepresentative,
    reelsPostCount,
    erVsBenchmark,
    daysSinceLastPost,
    sponsored,
    sponsoredShare,
    sponsoredCountAllSurfaces,
    primarySurface,
    surfaceGapPct,
    weakestSurface,
    commentQuality,
    brandSafety,
  } = params;

  const auth = (
    code: string,
    severity: FakeFlagSeverity,
    label: string,
    detail: string,
  ) =>
    flags.push({
      code,
      severity,
      impact: "authenticity" as const,
      label,
      detail,
      penalty: AUTHENTICITY_PENALTY[severity],
    });

  const perf = (
    code: string,
    severity: FakeFlagSeverity,
    label: string,
    detail: string,
    penalty = PERFORMANCE_PENALTY[severity],
  ) =>
    flags.push({
      code,
      severity,
      impact: "performance" as const,
      label,
      detail,
      penalty,
    });

  const data = (
    code: string,
    severity: FakeFlagSeverity,
    label: string,
    detail: string,
  ) =>
    flags.push({
      code,
      severity,
      impact: "data" as const,
      label,
      detail,
      // Kualitas data tidak menghukum skor — hanya menurunkan tingkat keyakinan.
      penalty: 0,
    });

  // ── Keaslian ──────────────────────────────────────────────────────────
  // Audiens asli berkomentar. Like yang dibeli datang tanpa komentar.
  const ratioFloor = COMMENT_RATIO_FLOOR[tier];
  if (
    commentLikeRatio !== null &&
    commentLikeRatio < ratioFloor &&
    commentRatioSampleSize >= MIN_RATIO_SAMPLE &&
    followers >= 1000
  ) {
    auth(
      "COMMENT_LIKE_RATIO_LOW",
      "high",
      "Komentar terlalu sedikit dibanding like",
      `Post biasanya hanya mendapat ${round(commentLikeRatio * 100, 2)}% komentar dari jumlah like — di bawah ambang ${round(ratioFloor * 100, 2)}% untuk tier ${TIER_LABEL[tier]}. Pola khas like berbayar.`,
    );
  }

  if (
    commentLikeRatio !== null &&
    commentLikeRatio > 0.2 &&
    commentRatioSampleSize >= MIN_RATIO_SAMPLE
  ) {
    auth(
      "COMMENT_LIKE_RATIO_HIGH",
      "medium",
      "Komentar tidak wajar banyak",
      `Komentar mencapai ${round(commentLikeRatio * 100)}% dari like pada post biasanya (sehat: 1–5%). Indikasi engagement pod atau bot komentar — angka ini nilai tengah, jadi bukan sekadar efek satu post giveaway.`,
    );
  }

  // View rate hanya sahih sebagai bukti follower mati di TikTok: di sana SEMUA
  // konten adalah video dan view memang jalur distribusinya. Di Instagram,
  // Reels didorong lewat rekomendasi — bukan ke follower — sehingga akun
  // dengan follower asli yang aktif di carousel tetap bisa punya Reels sepi.
  // Menyamakan keduanya membuat mayoritas akun Instagram salah dituduh.
  if (
    platform === InfluencerPlatform.TIKTOK &&
    viewRate !== null &&
    viewDataRepresentative &&
    viewRate < 10 &&
    followers >= 5000
  ) {
    auth(
      "LOW_VIEW_RATE",
      "high",
      "View jauh di bawah jumlah follower",
      `Nilai tengah view hanya ${round(viewRate)}% dari follower. Di TikTok view adalah jalur distribusinya, jadi angka serendah ini menandakan follower tidak aktif atau dibeli.`,
    );
  }

  if (
    platform === InfluencerPlatform.INSTAGRAM &&
    viewRate !== null &&
    // Sama seperti komponen jangkauan: kalau sebagian besar Reels tidak
    // melaporkan view, angkanya tidak layak dipakai memberi peringatan.
    viewDataRepresentative &&
    viewRate < 10 &&
    followers >= 5000
  ) {
    perf(
      "LOW_REELS_REACH",
      "medium",
      "Reels jangkauannya rendah",
      `Nilai tengah view Reels hanya ${round(viewRate)}% dari follower. Ini soal jangkauan konten video, BUKAN tanda follower palsu — di Instagram, Reels didistribusikan lewat rekomendasi, bukan ke follower. Pertimbangkan format feed/carousel bila ingin bekerja sama.`,
      // Tanpa penalti tambahan: komponen jangkauan sudah menghitungnya.
      0,
    );
  }

  // Akun asli punya konten yang meledak dan yang gagal. Engagement yang rata
  // di semua post adalah tanda paket engagement dengan kuota tetap.
  //
  // Diperiksa PER PERMUKAAN lalu disyaratkan konsisten: kalau Reels seragam
  // tapi feed bervariasi wajar, itu ciri format, bukan ciri paket engagement.
  if (flatSurfaces.length > 0 && !hasVariedSurface) {
    const worst = flatSurfaces[0];
    auth(
      "FLAT_ENGAGEMENT",
      "high",
      "Engagement terlalu seragam antar post",
      `Variasi engagement hanya ${round((worst.engagementCv ?? 0) * 100)}% dari rata-rata di ${SURFACE_LABEL[worst.surface]} (${worst.measuredCount} post). Akun organik biasanya di atas 40% karena ada konten yang viral dan yang gagal.`,
    );
  }

  if (erVsBenchmark > 4 && engagementSampleSize >= MIN_SAMPLE) {
    auth(
      "ER_OUTLIER_HIGH",
      "medium",
      "ER terlalu tinggi untuk tier-nya",
      `ER ${round(erVsBenchmark, 1)}× lipat median tier ini. Bisa berarti konten sangat kuat, tapi sering juga menandakan engagement dibeli — periksa bersama sinyal lain.`,
    );
  }

  if (followers >= 5000 && following > followers) {
    auth(
      "FOLLOWING_RATIO_HIGH",
      "medium",
      "Mengikuti lebih banyak dari pengikutnya",
      `Mengikuti ${following.toLocaleString("id-ID")} akun dengan ${followers.toLocaleString("id-ID")} follower. Pola khas taktik follow/unfollow, bukan audiens yang datang karena konten.`,
    );
  }

  // ── Kualitas komentar ─────────────────────────────────────────────────
  // Sengaja "medium": komentar pendek adalah kebiasaan wajar audiens
  // Indonesia, jadi sinyal ini menambah bobot bila berbarengan dengan yang
  // lain, tapi tidak boleh sendirian memvonis siapa pun.
  if (commentQuality) {
    if (commentQuality.lowSubstanceShare >= 0.85) {
      auth(
        "COMMENT_SUBSTANCE_LOW",
        "medium",
        "Hampir semua komentar tanpa substansi",
        `${Math.round(commentQuality.lowSubstanceShare * 100)}% dari ${commentQuality.analyzedComments} komentar yang terbaca hanya emoji atau pujian satu kata. Audiens yang benar-benar tertarik biasanya bertanya soal produk, harga, atau pengalaman.`,
      );
    }

    if (commentQuality.spamShare >= 0.3) {
      auth(
        "COMMENT_SPAM_HIGH",
        "medium",
        "Banyak komentar berpola jualan",
        `${Math.round(commentQuality.spamShare * 100)}% komentar berisi ajakan "cek bio", nomor WA, atau promosi lain. Kolom komentar seperti ini menenggelamkan percakapan tentang produk Anda.`,
      );
    }

    if (
      commentQuality.duplicateShare >= 0.25 ||
      commentQuality.repeatAuthorShare >= 0.5
    ) {
      auth(
        "COMMENT_POD_PATTERN",
        "medium",
        "Komentar datang dari lingkaran yang sama",
        `${Math.round(commentQuality.repeatAuthorShare * 100)}% komentar berasal dari akun yang muncul berulang di banyak post, dan ${Math.round(commentQuality.duplicateShare * 100)}% teksnya persis sama dengan komentar lain. Bisa penggemar setia, bisa juga engagement pod — periksa manual.`,
      );
    }
  }

  // ── Performa ──────────────────────────────────────────────────────────
  if (daysSinceLastPost !== null && daysSinceLastPost > 60) {
    perf(
      "STALE_ACCOUNT",
      "medium",
      "Akun lama tidak aktif",
      `Post terakhir ${daysSinceLastPost} hari lalu. Audiens kemungkinan sudah dingin.`,
      // Tanpa penalti: komponen konsistensi sudah menghitung keterlambatan ini.
      0,
    );
  }

  if (sponsored.deltaPct !== null && sponsored.deltaPct < -35) {
    perf(
      "SPONSORED_COLLAPSE",
      "high",
      "Engagement anjlok di post berbayar",
      `ER post berbayar ${Math.abs(sponsored.deltaPct)}% lebih rendah daripada post organik (${sponsored.sponsoredEr}% vs ${sponsored.organicEr}%) di ${primarySurface ? SURFACE_LABEL[primarySurface] : "permukaan utama"}. Inilah angka yang akan Anda dapat, bukan ER umumnya.`,
    );
  }

  // Feed penuh endorse membuat post berbayar berikutnya tenggelam: audiens
  // sudah terbiasa melewatinya.
  if (sponsoredShare >= 0.5 && sponsoredCountAllSurfaces >= 4) {
    perf(
      "SPONSORED_CLUTTER",
      "medium",
      "Kontennya didominasi endorse",
      `${Math.round(sponsoredShare * 100)}% post yang dianalisis (${sponsoredCountAllSurfaces} post) terdeteksi berbayar. Audiens yang tiap hari disuguhi endorse cenderung mengabaikannya, jadi post Anda ikut tenggelam. Deteksi ini batas bawah — kenyataannya bisa lebih tinggi.`,
      6,
    );
  }

  if (viralSkew !== null && viralSkew > 2 && engagementSampleSize >= MIN_SAMPLE) {
    perf(
      "VIRAL_SKEW",
      "medium",
      "Beberapa post viral mendominasi",
      `Rata-rata engagement ${round(viralSkew, 1)}× lipat nilai tengahnya. Post biasanya jauh di bawah angka rata-rata — jangan berpatokan pada rata-rata.`,
    );
  }

  // Selisih besar antar permukaan bukan cacat — itu instruksi pemesanan.
  if (
    surfaceGapPct !== null &&
    surfaceGapPct >= 50 &&
    primarySurface &&
    weakestSurface?.engagementRate != null
  ) {
    perf(
      "SURFACE_GAP",
      "low",
      `Hasilnya sangat bergantung format: pesan ${SURFACE_LABEL[primarySurface]}`,
      `ER di ${SURFACE_LABEL[primarySurface]} ${round(surfaceGapPct)}% lebih tinggi daripada di ${SURFACE_LABEL[weakestSurface.surface]} (${weakestSurface.engagementRate}%). Salah memesan format berarti membayar harga yang sama untuk hasil jauh lebih rendah.`,
      // Bukan hukuman: skor sudah memakai permukaan terkuat, ini instruksi.
      0,
    );
  }

  // ── Risiko asosiasi merek ─────────────────────────────────────────────
  for (const hit of brandSafety.hits) {
    flags.push({
      code: `BRAND_SAFETY_${hit.category}`,
      severity: hit.severity,
      impact: "brandSafety" as const,
      label: hit.label,
      detail: `${hit.postCount} post memuat istilah seperti "${hit.terms.slice(0, 3).join('", "')}"${hit.daysSinceLatest !== null ? `, terbaru ${hit.daysSinceLatest} hari lalu` : ""}. ${hit.why} Buka post-nya dan pastikan sebelum memutuskan — pencocokan kata bisa keliru menangkap konteks lain.`,
      // Tidak memotong skor: skor mengukur performa, ini soal risiko. Yang
      // berat menahan vonis di "perlu dicek" lewat aturan terpisah.
      penalty: 0,
    });
  }

  // ── Penyembunyian like ────────────────────────────────────────────────
  //
  // Menyembunyikan like di SELURUH akun adalah setelan, dan itu wajar — banyak
  // akun besar melakukannya. Menyembunyikannya pada SEBAGIAN post adalah
  // pilihan post per post: pemiliknya memutuskan angka mana yang boleh dilihat.
  // Keduanya ditangani berbeda.
  if (!engagementMeasurable) {
    data(
      "NO_ENGAGEMENT_DATA",
      "medium",
      "Jumlah like disembunyikan di semua post",
      "Akun ini menyembunyikan hitungan like, jadi engagement rate tidak bisa diukur langsung. Angkanya DIPERKIRAKAN dari jumlah komentar yang tetap publik — perkiraan itu bisa meleset beberapa kali lipat ke atas maupun ke bawah, jadi skornya ditahan di bawah nilai penuh dan vonis tertinggi tidak diberikan. Minta screenshot Instagram Insights (reach, like, simpan) untuk 5 post terakhir sebelum deal.",
    );
  } else if (hiddenLikePosts > 0) {
    data(
      "HIDDEN_LIKES",
      hiddenShare > HIDDEN_SHARE_MEDIUM_CONFIDENCE ? "medium" : "low",
      "Sebagian post menyembunyikan jumlah like",
      `${hiddenLikePosts} post menyembunyikan hitungan like (${round(hiddenShare * 100)}% dari permukaan utama). Angkanya tidak dianggap nol — itu akan membuat akun sehat terlihat mati — melainkan diperkirakan dari jumlah komentar post tersebut, yang tetap publik. Ini penting karena post yang disembunyikan sering justru yang performanya paling lemah; menilai akun hanya dari post yang angkanya dibiarkan terlihat akan melebihkan hasilnya.`,
    );
  }

  /**
   * Post berbayar jauh lebih sering disembunyikan daripada post organik.
   *
   * Ini bukan lagi soal kualitas data, tapi soal apa yang sedang ditutupi.
   * Brand diminta membeli persis format yang angkanya tidak boleh dilihat,
   * sementara post organik dibiarkan terpampang. Severity "medium", bukan
   * "high": deteksi berbayar hanyalah batas bawah, jadi sinyal ini boleh
   * mengurangi keaslian tapi belum boleh memvonis sendirian.
   */
  if (
    engagementMeasurable &&
    hiddenSponsoredPosts >= 2 &&
    hiddenSponsoredShare > hiddenOrganicShare * SPONSORED_HIDING_MULTIPLE
  ) {
    auth(
      "HIDDEN_LIKES_ON_SPONSORED",
      "medium",
      "Justru post berbayar yang like-nya disembunyikan",
      `${hiddenSponsoredPosts} post berbayar menyembunyikan jumlah like (${round(hiddenSponsoredShare * 100)}% dari post berbayarnya), jauh di atas kekerapan pada post organik (${round(hiddenOrganicShare * 100)}%). Akun ini membiarkan angka post organiknya terlihat tapi menutup angka post yang dibayar brand — persis jenis post yang akan Anda beli. Minta bukti performa endorse sebelumnya secara langsung.`,
    );
  }

  if (postsAnalyzed < MIN_SAMPLE || engagementSampleSize < MIN_SAMPLE) {
    data(
      "THIN_SAMPLE",
      "low",
      "Sampel post terlalu sedikit",
      engagementSampleSize < MIN_SAMPLE && postsAnalyzed >= MIN_SAMPLE
        ? `Engagement rate dihitung hanya dari ${engagementSampleSize} post di ${primarySurface ? SURFACE_LABEL[primarySurface] : "permukaan utama"} (dari ${postsAnalyzed} post yang dianalisis) — permukaan lain dinilai terpisah. Angkanya masih bisa berubah banyak.`
        : `Hanya ${postsAnalyzed} post yang bisa dianalisis. Angka ER masih bisa berubah banyak — perlakukan sebagai indikasi awal.`,
    );
  }

  if (sampleWindowDays !== null && sampleWindowDays > SAMPLE_WINDOW_DAYS) {
    data(
      "WIDE_SAMPLE_WINDOW",
      "low",
      "Sampel mencakup rentang waktu panjang",
      `Post yang dianalisis tersebar sepanjang ${Math.round(sampleWindowDays)} hari karena akun jarang posting. Engagement lama kurang memprediksi hasil kampanye sekarang.`,
    );
  }

  if (platform === InfluencerPlatform.INSTAGRAM && reelsPostCount === 0) {
    data(
      "NO_VIEW_DATA",
      "low",
      "Tidak ada Reels untuk diukur",
      "Tab Reels akun ini kosong atau tidak bisa diambil, jadi jangkauan konten videonya tidak terukur. Engagement tetap dihitung dari post feed.",
    );
  } else if (viewCoverage !== null && !viewDataRepresentative) {
    // Reels-nya ada, hitungan view-nya yang tidak lengkap — dua hal berbeda
    // yang dulu dilaporkan dengan kalimat yang sama dan menyesatkan.
    data(
      "PARTIAL_VIEW_DATA",
      "low",
      "Hitungan view tidak lengkap di Reels",
      viewCoverage === 0
        ? "Tidak satu pun Reels melaporkan jumlah view, jadi jangkauan tidak terukur. Komponen jangkauan dinilai netral, bukan nol."
        : `Hanya ${Math.round(viewCoverage * 100)}% Reels yang melaporkan jumlah view, jadi angka jangkauan di halaman ini dihitung dari sebagian kecil saja. Komponen jangkauan dinilai netral agar tidak menghukum berdasarkan data yang tidak lengkap.`,
    );
  }

  if (!commentQuality) {
    data(
      "NO_COMMENT_SAMPLE",
      "low",
      "Isi komentar tidak ikut terambil",
      "Dataset tidak membawa cukup contoh komentar, jadi kualitas komentar (bot vs manusia) tidak dinilai. Rasio komentar tetap dihitung dari jumlahnya.",
    );
  }

  if (sponsored.sponsoredCount >= 3 && sponsored.organicCount < MIN_SPLIT_SAMPLE) {
    data(
      "ALL_SPONSORED",
      "low",
      "Hampir semua post terdeteksi berbayar",
      "Tidak ada cukup post organik sebagai pembanding, jadi penurunan engagement pada konten berbayar tidak bisa diukur.",
    );
  }

  if (sponsoredCountAllSurfaces === 0 && postsAnalyzed >= MIN_SAMPLE) {
    data(
      "NO_SPONSORED_MARKER",
      "low",
      "Tidak ada post berbayar terdeteksi",
      "Tidak ditemukan penanda endorse (#ad, #kerjasama, label paid partnership). Banyak influencer tidak mencantumkannya, jadi ini belum tentu berarti mereka tidak pernah endorse.",
    );
  }

  return flags;
}

/**
 * Hitung seluruh metrik audit dari profil yang sudah dinormalisasi.
 *
 * Fungsi murni — tidak menyentuh DB, Apify, maupun waktu sistem kecuali lewat
 * `input.now`, supaya seluruh logika penilaian bisa diuji.
 */
export function scoreInfluencer(
  input: InfluencerScoreInput,
): InfluencerScoreResult {
  const now = input.now ?? new Date();
  const followers = Math.max(input.followers, 0);
  const tier = resolveTier(followers);
  const benchmarkEr = benchmarkErFor(input.platform, tier);

  const sample = selectSample(input.posts, now);
  const postsAnalyzed = sample.length;

  /**
   * Feed dan Reels adalah dua permukaan berbeda dengan perilaku berbeda:
   * audiens bisa ramai di carousel tapi sepi di Reels, atau sebaliknya.
   * Digabung jadi satu angka, keduanya saling menutupi.
   *
   * Tiap permukaan dinilai penuh dan terpisah, lalu angka utama diambil dari
   * permukaan TERKUAT — karena itulah format yang akan dipesan brand. Grid
   * yang lemah tidak boleh menyeret turun akun yang Reels-nya kuat, dan
   * sebaliknya. Di TikTok tidak ada pemisahan ini: semua konten adalah video.
   */
  const reelPosts = sample.filter((p) => p.surface === "reels");
  const feedPosts = sample.filter((p) => p.surface === "feed");

  const surfaces: SurfaceStats[] = [];
  if (feedPosts.length > 0) {
    surfaces.push(buildSurfaceStats("feed", feedPosts, followers, benchmarkEr));
  }
  if (reelPosts.length > 0) {
    surfaces.push(buildSurfaceStats("reels", reelPosts, followers, benchmarkEr));
  }

  const scored = surfaces.filter((s) => s.engagementRate !== null);
  // Permukaan dengan sampel terlalu tipis boleh dilaporkan, tapi belum boleh
  // jadi dasar janji — kecuali memang tidak ada permukaan lain.
  const eligible = scored.filter((s) => s.measuredCount >= MIN_SURFACE_SAMPLE);
  const pool = eligible.length > 0 ? eligible : scored;
  const primary =
    pool.length > 0
      ? pool.reduce((best, s) =>
          (s.engagementRate as number) > (best.engagementRate as number) ? s : best,
        )
      : null;
  // Permukaan terlemah diambil dari kolam yang sama dengan permukaan utama:
  // menyuruh orang "pesan Reels, jangan feed" berdasarkan satu post feed sama
  // menyesatkannya dengan menilai akun dari satu post.
  const weakest =
    pool.length > 1
      ? pool.reduce((worst, s) =>
          (s.engagementRate as number) < (worst.engagementRate as number) ? s : worst,
        )
      : null;

  const primaryPosts = primary
    ? primary.surface === "feed"
      ? feedPosts
      : reelPosts
    : sample;
  const engagementSample = primaryPosts.filter(isMeasurable);
  const engagementMeasurable = engagementSample.length > 0;
  const hiddenLikePosts = sample.filter((p) => !isMeasurable(p)).length;

  /**
   * Porsi permukaan utama yang angkanya harus diperkirakan. Dihitung dari
   * permukaan utama — bukan seluruh sampel — karena permukaan itulah yang
   * menjadi dasar ER dan komponen engagement.
   */
  const hiddenShare =
    primaryPosts.length > 0
      ? primaryPosts.filter((p) => !isMeasurable(p)).length / primaryPosts.length
      : 0;

  // Kekerapan penyembunyian pada post berbayar vs organik. Selisih besar di
  // antara keduanya adalah pilihan sadar, bukan setelan akun.
  const sponsoredSamplePosts = sample.filter((p) => isSponsoredPost(p));
  const organicSamplePosts = sample.filter((p) => !isSponsoredPost(p));
  const hiddenSponsoredPosts = sponsoredSamplePosts.filter(
    (p) => !isMeasurable(p),
  ).length;
  const hiddenOrganicPosts = organicSamplePosts.filter(
    (p) => !isMeasurable(p),
  ).length;
  const hiddenSponsoredShare =
    sponsoredSamplePosts.length > 0
      ? hiddenSponsoredPosts / sponsoredSamplePosts.length
      : 0;
  const hiddenOrganicShare =
    organicSamplePosts.length > 0
      ? hiddenOrganicPosts / organicSamplePosts.length
      : 0;

  const likes = engagementSample.map((p) => p.likes);
  const comments = engagementSample.map((p) => p.comments);
  const shares = engagementSample.map((p) => p.shares);
  // View HANYA diambil dari Reels: itulah satu-satunya sumber yang benar.
  const viewsWithData = reelPosts.map((p) => p.views).filter((v) => v > 0);
  const standard = engagementSample.map(standardInteractions);
  const total = engagementSample.map(totalInteractions);

  const medianLikes = median(likes);
  const medianComments = median(comments);
  const medianShares = median(shares);
  const medianViews = median(viewsWithData);
  const medianStandard = median(standard);
  const medianTotal = median(total);

  // Interaksi Reels dihitung dari Reels sendiri — bukan dari feed — supaya
  // ER-terhadap-view tidak mencampur like carousel dengan view Reels.
  const measuredReels = reelPosts.filter(isMeasurable);
  const medianReelInteractions = median(measuredReels.map(totalInteractions));

  const feedStats = surfaces.find((s) => s.surface === "feed") ?? null;
  const reelStats = surfaces.find((s) => s.surface === "reels") ?? null;

  const engagementRate =
    followers > 0 ? (medianStandard / followers) * 100 : 0;
  const totalEngagementRate =
    followers > 0 ? (medianTotal / followers) * 100 : 0;
  const viewEngagementRate =
    medianViews > 0 ? (medianReelInteractions / medianViews) * 100 : null;
  const viewRate =
    medianViews > 0 && followers > 0 ? (medianViews / followers) * 100 : null;

  /**
   * Berapa bagian Reels yang benar-benar punya hitungan view. Kalau sebagian
   * besar Reels tidak melaporkan view, angka jangkauannya tidak bisa dipercaya.
   */
  const viewCoverage =
    reelPosts.length > 0 ? viewsWithData.length / reelPosts.length : null;
  const viewDataRepresentative = viewCoverage !== null && viewCoverage >= 0.8;

  const postsPerWeek = computeCadence(sample);

  const timestamps = sample
    .map((p) => p.postedAt?.getTime())
    .filter((t): t is number => typeof t === "number");
  const daysSinceLastPost =
    timestamps.length > 0
      ? Math.max(Math.floor((now.getTime() - Math.max(...timestamps)) / DAY_MS), 0)
      : null;
  const sampleWindowDays =
    timestamps.length >= 2
      ? (Math.max(...timestamps) - Math.min(...timestamps)) / DAY_MS
      : null;

  // Rasio komentar dihitung dari SELURUH permukaan: ini sifat audiens, bukan
  // sifat format, dan sampel yang lebih besar membuatnya jauh lebih stabil.
  const { ratio: commentLikeRatio, sampleSize: commentRatioSampleSize } =
    medianCommentLikeRatio(sample);

  /**
   * ER untuk PENILAIAN, dengan like tersembunyi diperkirakan dari komentar.
   *
   * `engagementRate` di atas sengaja hanya memakai post terukur: itu angka
   * yang dilaporkan ke pengguna dan harus jujur menyebut apa yang benar-benar
   * diukur. Tapi MENILAI akun hanya dari post yang like-nya dibiarkan terlihat
   * membuka dua celah — akun yang menyembunyikan seluruh like dapat nilai
   * netral gratis, dan akun yang menyembunyikan post-post lemahnya saja dinilai
   * dari sisa terbaiknya. Keduanya membuat menyembunyikan like jadi strategi
   * yang menguntungkan, yang justru kebalikan dari tujuan audit ini.
   */
  const imputationRatio = imputationRatioFor(commentLikeRatio);
  const scoringInteractions = primaryPosts.map((p) =>
    imputedStandardInteractions(p, imputationRatio),
  );
  const imputedEngagementRate =
    followers > 0 && scoringInteractions.length > 0
      ? (median(scoringInteractions) / followers) * 100
      : 0;

  const engagementSampleSize = engagementSample.length;
  const meanTotal = mean(total);
  const engagementCv = primary?.engagementCv ?? null;
  const viralSkew =
    engagementSampleSize >= 2 && medianTotal > 0 ? meanTotal / medianTotal : null;

  // Seragam-atau-tidak diperiksa per permukaan supaya ciri format tidak
  // tertukar dengan ciri paket engagement.
  const flatSurfaces = surfaces.filter(
    (s) => s.measuredCount >= 8 && s.engagementCv !== null && s.engagementCv < 0.15,
  );
  const hasVariedSurface = surfaces.some(
    (s) => s.measuredCount >= 8 && s.engagementCv !== null && s.engagementCv >= 0.15,
  );

  // Tren: separuh post terbaru dibanding separuh terlama, dihitung pada
  // himpunan yang sama dengan yang menghasilkan angkanya (sampel urut menurun).
  let engagementTrendPct: number | null = null;
  if (engagementSampleSize >= MIN_SAMPLE) {
    const half = Math.floor(engagementSampleSize / 2);
    const recent = median(total.slice(0, half));
    const older = median(total.slice(engagementSampleSize - half));
    if (older > 0) engagementTrendPct = ((recent - older) / older) * 100;
  }

  const erVsBenchmark = benchmarkEr > 0 ? engagementRate / benchmarkEr : 0;
  const followingRatio = followers > 0 ? input.following / followers : null;
  // Dibandingkan dalam permukaan yang sama dengan `engagementRate`, supaya
  // post berbayar tidak diadu melawan post organik dari permukaan berbeda.
  const sponsored = primary
    ? primary.sponsored
    : computeSponsoredSplit(engagementSample, followers);

  // Kepadatan endorse dihitung dari seluruh permukaan: yang dilihat audiens
  // adalah profilnya secara utuh, bukan satu tab saja.
  const sponsoredCountAllSurfaces = sponsoredSamplePosts.length;
  const sponsoredShare =
    postsAnalyzed > 0 ? sponsoredCountAllSurfaces / postsAnalyzed : 0;

  const surfaceGapPct =
    primary?.engagementRate != null &&
    weakest?.engagementRate != null &&
    weakest.surface !== primary.surface &&
    weakest.engagementRate > 0
      ? ((primary.engagementRate - weakest.engagementRate) /
          weakest.engagementRate) *
        100
      : null;

  const confidence = resolveConfidence(
    postsAnalyzed,
    engagementSampleSize,
    sampleWindowDays,
    hiddenShare,
  );

  // Risiko asosiasi dipindai dari SELURUH post yang diambil, bukan hanya yang
  // masuk sampel: post judi delapan bulan lalu tetap terpampang di profil.
  const brandSafety = scanBrandSafety(
    input.posts.map((p) => ({
      caption: p.caption,
      url: p.url,
      postedAt: p.postedAt ?? null,
    })),
    now,
  );
  const commentQuality = analyzeCommentQuality(sample);

  const fakeFlags = detectSignals({
    platform: input.platform,
    tier,
    followers,
    following: input.following,
    postsAnalyzed,
    engagementSampleSize,
    engagementMeasurable,
    hiddenLikePosts,
    hiddenShare,
    hiddenSponsoredPosts,
    hiddenSponsoredShare,
    hiddenOrganicShare,
    sampleWindowDays,
    commentLikeRatio,
    commentRatioSampleSize,
    flatSurfaces,
    hasVariedSurface,
    viralSkew,
    viewRate,
    viewCoverage,
    viewDataRepresentative,
    reelsPostCount: reelPosts.length,
    erVsBenchmark,
    daysSinceLastPost,
    sponsored,
    sponsoredShare,
    sponsoredCountAllSurfaces,
    primarySurface: primary?.surface ?? null,
    surfaceGapPct,
    weakestSurface: weakest,
    commentQuality,
    brandSafety,
  });

  const authenticityPenalty = fakeFlags
    .filter((f) => f.impact === "authenticity")
    .reduce((sum, f) => sum + f.penalty, 0);
  const authenticityScore = clamp(Math.round(100 - authenticityPenalty), 0, 100);

  const performancePenalty = fakeFlags
    .filter((f) => f.impact === "performance")
    .reduce((sum, f) => sum + f.penalty, 0);

  /**
   * Komponen engagement.
   *
   * Tanpa satu pun post tersembunyi, dipakai angka terukur apa adanya. Begitu
   * ada yang disembunyikan, dasarnya pindah ke ER perkiraan — dan hasilnya
   * ditahan dua lapis:
   *
   * 1. Bila rasio komentar akun ini sendiri tidak diketahui (semua like
   *    disembunyikan), perkiraannya dicampur ke netral. Kita memang tidak tahu,
   *    dan angka yang tidak diketahui tidak boleh menghukum maupun menghadiahi
   *    terlalu jauh.
   * 2. Plafon yang melandai sesuai porsi data yang diperkirakan. Nilai penuh
   *    hanya untuk angka yang benar-benar terukur.
   */
  const imputedErVsBenchmark =
    benchmarkEr > 0 ? imputedEngagementRate / benchmarkEr : 0;
  const imputeWeight = commentLikeRatio !== null ? 1 : GENERIC_IMPUTE_WEIGHT;
  const imputedCeiling =
    100 - (100 - IMPUTED_ENGAGEMENT_CEILING) * clamp(hiddenShare, 0, 1);

  const engagementComponent =
    hiddenShare <= 0
      ? scoreFromRatio(erVsBenchmark)
      : Math.min(
          scoreFromRatio(imputedErVsBenchmark) * imputeWeight +
            NEUTRAL_ENGAGEMENT * (1 - imputeWeight),
          imputedCeiling,
        );
  const consistencyComponent =
    scoreCadence(postsPerWeek) * 0.6 + scoreRecency(daysSinceLastPost) * 0.4;
  // Jangkauan diukur dari Reels, dengan target per platform. Bila sebagian
  // besar Reels tidak melaporkan view, angkanya tidak dapat dipercaya dan
  // komponen ini jatuh ke netral — bukan nol, karena ketiadaan data bukan
  // bukti jangkauan buruk.
  const reachComponent =
    viewRate !== null && viewDataRepresentative
      ? clamp((viewRate / REACH_TARGET[input.platform]) * 100, 0, 100)
      : 60;

  const rawScore =
    engagementComponent * 0.45 +
    consistencyComponent * 0.2 +
    reachComponent * 0.2 +
    authenticityScore * 0.15 -
    performancePenalty;

  /**
   * Tuduhan kecurangan butuh korroborasi.
   *
   * Tiap sinyal punya tingkat salah-tuduh sendiri, jadi satu sinyal berdiri
   * sendiri hanya cukup untuk menahan dan memeriksa manual — bukan memvonis.
   * Dua sinyal berat yang saling menguatkan barulah kesimpulan.
   *
   * Sinyal berat tetap tidak boleh tertutup bobot komponen: justru angka
   * engagement tinggi itulah yang sedang dipertanyakan, jadi skornya dibatasi.
   */
  const highAuthenticityFlags = fakeFlags.filter(
    (f) => f.impact === "authenticity" && f.severity === "high",
  ).length;

  const scoreCeiling =
    highAuthenticityFlags >= 2 ? 45 : highAuthenticityFlags === 1 ? 60 : 100;
  const score = clamp(Math.min(Math.round(rawScore), scoreCeiling), 0, 100);

  let verdict: InfluencerVerdict;
  if (authenticityScore < 50 || highAuthenticityFlags >= 2) {
    verdict = InfluencerVerdict.SUSPICIOUS;
  } else if (highAuthenticityFlags === 1) {
    verdict = InfluencerVerdict.NEEDS_REVIEW;
  } else if (score >= 80) verdict = InfluencerVerdict.EXCELLENT;
  else if (score >= 65) verdict = InfluencerVerdict.GOOD;
  else if (score >= 45) verdict = InfluencerVerdict.AVERAGE;
  else verdict = InfluencerVerdict.POOR;

  // Vonis terbaik menuntut bukti yang cukup. Empat post tidak boleh
  // menghasilkan "sangat bagus" — angkanya masih bisa bergerak jauh.
  if (verdict === InfluencerVerdict.EXCELLENT && confidence === "low") {
    verdict = InfluencerVerdict.GOOD;
  }

  // Engagement yang sebagian besarnya diperkirakan — bukan diukur — tidak boleh
  // menghasilkan rekomendasi tertinggi. "Sangat bagus" adalah janji ke tim yang
  // akan membelanjakan uang, dan janji menuntut angka yang bisa diverifikasi.
  if (
    verdict === InfluencerVerdict.EXCELLENT &&
    hiddenShare > HIDDEN_SHARE_MEDIUM_CONFIDENCE
  ) {
    verdict = InfluencerVerdict.GOOD;
  }

  // Risiko asosiasi berat (judi online, konten dewasa) menahan rekomendasi
  // sampai manusia memeriksanya — sebagus apa pun angkanya.
  if (
    brandSafety.worstSeverity === "high" &&
    (verdict === InfluencerVerdict.EXCELLENT || verdict === InfluencerVerdict.GOOD)
  ) {
    verdict = InfluencerVerdict.NEEDS_REVIEW;
  }

  // Prediksi hasil kampanye: pakai ER post berbayar bila sampelnya memadai.
  const useSponsored =
    sponsored.sponsoredEr !== null &&
    sponsored.sponsoredCount >= MIN_SPLIT_SAMPLE;
  const expectedCampaignEr = useSponsored
    ? (sponsored.sponsoredEr as number)
    : round(engagementRate, 3);

  return {
    tier,
    benchmarkEr,
    postsFetched: input.posts.length,
    postsAnalyzed,
    sampleWindowDays:
      sampleWindowDays === null ? null : Math.round(sampleWindowDays),
    confidence,
    medianLikes: round(medianLikes),
    medianComments: round(medianComments),
    medianShares: round(medianShares),
    medianViews: round(medianViews),
    avgLikes: round(mean(likes)),
    avgComments: round(mean(comments)),
    avgShares: round(mean(shares)),
    avgViews: round(mean(viewsWithData)),
    engagementRate: round(engagementRate, 3),
    totalEngagementRate: round(totalEngagementRate, 3),
    viewEngagementRate:
      viewEngagementRate === null ? null : round(viewEngagementRate, 3),
    viewRate: viewRate === null ? null : round(viewRate, 2),
    feedPostCount: feedPosts.length,
    reelsPostCount: reelPosts.length,
    feedEngagementRate: feedStats?.engagementRate ?? null,
    reelsEngagementRate: reelStats?.engagementRate ?? null,
    primarySurface: primary?.surface ?? null,
    surfaces,
    postsPerWeek: round(postsPerWeek),
    daysSinceLastPost,
    score,
    verdict,
    authenticityScore,
    fakeFlags,
    sponsored,
    brandSafety,
    commentQuality,
    metrics: {
      erVsBenchmark: round(erVsBenchmark, 2),
      commentLikeRatio:
        commentLikeRatio === null ? null : round(commentLikeRatio, 4),
      engagementCv,
      engagementTrendPct:
        engagementTrendPct === null ? null : round(engagementTrendPct, 1),
      followingRatio: followingRatio === null ? null : round(followingRatio, 2),
      viralSkew: viralSkew === null ? null : round(viralSkew, 2),
      viewCoverage: viewCoverage === null ? null : round(viewCoverage, 2),
      viewSampleCount: viewsWithData.length,
      viewDataRepresentative,
      highAuthenticityFlags,
      expectedCampaignEr,
      expectedCampaignErSource: useSponsored ? "sponsored" : "overall",
      primarySurface: primary?.surface ?? null,
      feedEngagementRate: feedStats?.engagementRate ?? null,
      reelsEngagementRate: reelStats?.engagementRate ?? null,
      surfaceGapPct: surfaceGapPct === null ? null : round(surfaceGapPct, 1),
      engagementMeasurable,
      hiddenLikePosts,
      hiddenLikeShare: round(hiddenShare, 3),
      hiddenSponsoredPosts,
      imputedEngagementRate: round(imputedEngagementRate, 3),
      imputationRatio: round(imputationRatio, 4),
      engagementImputed: hiddenShare > 0,
      sponsoredShare: round(sponsoredShare, 3),
      sponsoredCountAllSurfaces,
      brandSafetyWorstSeverity: brandSafety.worstSeverity,
      brandSafety,
      commentQuality,
      components: {
        engagement: round(engagementComponent),
        consistency: round(consistencyComponent),
        reach: round(reachComponent),
        authenticity: authenticityScore,
        performancePenalty,
      },
    },
  };
}

/** ER per post (standar: like + komentar) — dipakai tabel post di UI. */
export function postEngagementRate(
  post: NormalizedInfluencerPost,
  followers: number,
): number {
  if (followers <= 0) return 0;
  // Like disembunyikan: ER-nya tidak diketahui, dan menampilkan angka
  // komentar-saja akan terbaca sebagai "engagement-nya nyaris nol".
  if (post.likesHidden) return 0;
  return round((standardInteractions(post) / followers) * 100, 3);
}

export const VERDICT_LABEL: Record<InfluencerVerdict, string> = {
  EXCELLENT: "Sangat bagus",
  GOOD: "Bagus",
  AVERAGE: "Rata-rata",
  POOR: "Lemah",
  NEEDS_REVIEW: "Perlu dicek",
  SUSPICIOUS: "Mencurigakan",
};

export const CONFIDENCE_LABEL: Record<SampleConfidence, string> = {
  high: "Tinggi",
  medium: "Sedang",
  low: "Rendah",
};
