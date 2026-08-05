import {
  InfluencerPlatform,
  InfluencerTier,
  InfluencerVerdict,
} from "@prisma/client";
import type { NormalizedInfluencerPost } from "@/lib/apify/normalize-influencer";
import { isSponsoredPost } from "@/lib/brand-research/influencer/sponsored";

export type FakeFlagSeverity = "high" | "medium" | "low";

/**
 * Apa yang sebenarnya dipertanyakan oleh sebuah sinyal.
 *
 * Pemisahan ini penting: akun foto Instagram tanpa data view bukanlah akun
 * yang tidak asli — itu keterbatasan data. Menghukum skor keaslian karenanya
 * membuat penilaian salah.
 */
export type FlagImpact = "authenticity" | "performance" | "data";

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
   * ER standar: (like + komentar) / follower. Definisi yang dipakai tabel
   * median industri, jadi hanya angka INI yang boleh dibandingkan ke benchmark.
   */
  engagementRate: number;
  /** ER termasuk share & simpan — nilai penuh bagi brand, tapi tak sebanding benchmark. */
  totalEngagementRate: number;
  viewEngagementRate: number | null;
  viewRate: number | null;

  postsPerWeek: number;
  daysSinceLastPost: number | null;

  score: number;
  verdict: InfluencerVerdict;
  authenticityScore: number;
  fakeFlags: InfluencerFakeFlag[];
  sponsored: SponsoredSplit;

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
    /** Jumlah sinyal keaslian berat — 2 atau lebih baru jadi SUSPICIOUS. */
    highAuthenticityFlags: number;
    /**
     * Perkiraan ER yang akan didapat brand bila memasang campaign — memakai
     * ER post berbayar bila sampelnya memadai, kalau tidak jatuh ke ER umum.
     */
    expectedCampaignEr: number;
    expectedCampaignErSource: "sponsored" | "overall";
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
  const sorted = [...posts].sort((a, b) => {
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

function resolveConfidence(
  postsAnalyzed: number,
  sampleWindowDays: number | null,
): SampleConfidence {
  if (postsAnalyzed < MIN_SAMPLE) return "low";
  if (sampleWindowDays !== null && sampleWindowDays > SAMPLE_WINDOW_DAYS) {
    return "low";
  }
  if (postsAnalyzed >= 10) return "high";
  return "medium";
}

function detectSignals(params: {
  platform: InfluencerPlatform;
  followers: number;
  following: number;
  postsAnalyzed: number;
  sampleWindowDays: number | null;
  commentLikeRatio: number | null;
  engagementCv: number | null;
  viralSkew: number | null;
  viewRate: number | null;
  /** Bagian post sampel yang punya hitungan view (0–1). */
  viewCoverage: number | null;
  erVsBenchmark: number;
  daysSinceLastPost: number | null;
  sponsored: SponsoredSplit;
}): InfluencerFakeFlag[] {
  const flags: InfluencerFakeFlag[] = [];
  const {
    platform,
    followers,
    following,
    postsAnalyzed,
    sampleWindowDays,
    commentLikeRatio,
    engagementCv,
    viralSkew,
    viewRate,
    viewCoverage,
    erVsBenchmark,
    daysSinceLastPost,
    sponsored,
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
  if (commentLikeRatio !== null && commentLikeRatio < 0.004 && followers >= 1000) {
    auth(
      "COMMENT_LIKE_RATIO_LOW",
      "high",
      "Komentar terlalu sedikit dibanding like",
      `Hanya ${round(commentLikeRatio * 100)}% dari like yang disertai komentar (sehat: 1–5%). Pola khas like berbayar.`,
    );
  }

  if (commentLikeRatio !== null && commentLikeRatio > 0.2) {
    auth(
      "COMMENT_LIKE_RATIO_HIGH",
      "medium",
      "Komentar tidak wajar banyak",
      `Komentar mencapai ${round(commentLikeRatio * 100)}% dari like (sehat: 1–5%). Indikasi engagement pod atau bot komentar.`,
    );
  }

  // View rate hanya sahih sebagai bukti follower mati di TikTok: di sana SEMUA
  // konten adalah video dan view memang jalur distribusinya. Di Instagram,
  // Reels didorong lewat rekomendasi — bukan ke follower — sehingga akun
  // dengan follower asli yang aktif di carousel tetap bisa punya Reels sepi.
  // Menyamakan keduanya membuat mayoritas akun Instagram salah dituduh.
  const viewDataRepresentative = viewCoverage !== null && viewCoverage >= 0.8;

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
    viewRate < 10 &&
    followers >= 5000
  ) {
    perf(
      "LOW_REELS_REACH",
      "medium",
      "Reels jangkauannya rendah",
      `Nilai tengah view Reels hanya ${round(viewRate)}% dari follower${viewCoverage !== null && viewCoverage < 0.8 ? ` (dihitung dari ${Math.round(viewCoverage * 100)}% post yang berupa video)` : ""}. Ini soal jangkauan konten video, BUKAN tanda follower palsu — di Instagram, Reels didistribusikan lewat rekomendasi, bukan ke follower. Pertimbangkan format feed/carousel bila ingin bekerja sama.`,
      // Tanpa penalti tambahan: komponen jangkauan sudah menghitungnya.
      0,
    );
  }

  // Akun asli punya konten yang meledak dan yang gagal. Engagement yang rata
  // di semua post adalah tanda paket engagement dengan kuota tetap.
  if (engagementCv !== null && engagementCv < 0.15 && postsAnalyzed >= 8) {
    auth(
      "FLAT_ENGAGEMENT",
      "high",
      "Engagement terlalu seragam antar post",
      `Variasi engagement hanya ${round(engagementCv * 100)}% dari rata-rata. Akun organik biasanya di atas 40% karena ada konten yang viral dan yang gagal.`,
    );
  }

  if (erVsBenchmark > 4 && postsAnalyzed >= MIN_SAMPLE) {
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
      `ER post berbayar ${Math.abs(sponsored.deltaPct)}% lebih rendah daripada post organik (${sponsored.sponsoredEr}% vs ${sponsored.organicEr}%). Inilah angka yang akan Anda dapat, bukan ER umumnya.`,
    );
  }

  if (viralSkew !== null && viralSkew > 2 && postsAnalyzed >= MIN_SAMPLE) {
    perf(
      "VIRAL_SKEW",
      "medium",
      "Beberapa post viral mendominasi",
      `Rata-rata engagement ${round(viralSkew, 1)}× lipat nilai tengahnya. Post biasanya jauh di bawah angka rata-rata — jangan berpatokan pada rata-rata.`,
    );
  }

  // ── Kualitas data ─────────────────────────────────────────────────────
  if (postsAnalyzed < MIN_SAMPLE) {
    data(
      "THIN_SAMPLE",
      "low",
      "Sampel post terlalu sedikit",
      `Hanya ${postsAnalyzed} post yang bisa dianalisis. Angka ER masih bisa berubah banyak — perlakukan sebagai indikasi awal.`,
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

  if (platform === InfluencerPlatform.INSTAGRAM && viewRate === null) {
    data(
      "NO_VIEW_DATA",
      "low",
      "Tidak ada data view",
      "Post yang diambil berupa foto/carousel tanpa hitungan view, jadi kualitas jangkauan tidak bisa diverifikasi — ER hanya dihitung terhadap follower.",
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

  if (sponsored.sponsoredCount === 0 && postsAnalyzed >= MIN_SAMPLE) {
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

  const likes = sample.map((p) => p.likes);
  const comments = sample.map((p) => p.comments);
  const shares = sample.map((p) => p.shares);
  const viewsWithData = sample.map((p) => p.views).filter((v) => v > 0);
  const standard = sample.map(standardInteractions);
  const total = sample.map(totalInteractions);

  const medianLikes = median(likes);
  const medianComments = median(comments);
  const medianShares = median(shares);
  const medianViews = median(viewsWithData);
  const medianStandard = median(standard);
  const medianTotal = median(total);

  const engagementRate =
    followers > 0 ? (medianStandard / followers) * 100 : 0;
  const totalEngagementRate =
    followers > 0 ? (medianTotal / followers) * 100 : 0;
  const viewEngagementRate =
    medianViews > 0 ? (medianTotal / medianViews) * 100 : null;
  const viewRate =
    medianViews > 0 && followers > 0 ? (medianViews / followers) * 100 : null;

  /**
   * Berapa bagian sampel yang sebenarnya punya hitungan view.
   *
   * Di Instagram hanya Reels yang punya view, sementara like dihitung dari
   * SEMUA post. Tanpa memeriksa cakupan ini, view rate akan membandingkan
   * subset video melawan follower lalu dipakai memvonis seluruh akun —
   * membandingkan dua hal yang tidak sebanding.
   */
  const viewCoverage =
    postsAnalyzed > 0 ? viewsWithData.length / postsAnalyzed : null;
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

  const totalLikes = likes.reduce((s, v) => s + v, 0);
  const totalComments = comments.reduce((s, v) => s + v, 0);
  const commentLikeRatio = totalLikes > 0 ? totalComments / totalLikes : null;

  const meanTotal = mean(total);
  const engagementCv =
    postsAnalyzed >= 2 && meanTotal > 0 ? stdDev(total) / meanTotal : null;
  const viralSkew =
    postsAnalyzed >= 2 && medianTotal > 0 ? meanTotal / medianTotal : null;

  // Tren: separuh post terbaru dibanding separuh terlama (sampel urut menurun).
  let engagementTrendPct: number | null = null;
  if (postsAnalyzed >= MIN_SAMPLE) {
    const half = Math.floor(postsAnalyzed / 2);
    const recent = median(total.slice(0, half));
    const older = median(total.slice(postsAnalyzed - half));
    if (older > 0) engagementTrendPct = ((recent - older) / older) * 100;
  }

  const erVsBenchmark = benchmarkEr > 0 ? engagementRate / benchmarkEr : 0;
  const followingRatio = followers > 0 ? input.following / followers : null;
  const sponsored = computeSponsoredSplit(sample, followers);
  const confidence = resolveConfidence(postsAnalyzed, sampleWindowDays);

  const fakeFlags = detectSignals({
    platform: input.platform,
    followers,
    following: input.following,
    postsAnalyzed,
    sampleWindowDays,
    commentLikeRatio,
    engagementCv,
    viralSkew,
    viewRate,
    viewCoverage,
    erVsBenchmark,
    daysSinceLastPost,
    sponsored,
  });

  const authenticityPenalty = fakeFlags
    .filter((f) => f.impact === "authenticity")
    .reduce((sum, f) => sum + f.penalty, 0);
  const authenticityScore = clamp(Math.round(100 - authenticityPenalty), 0, 100);

  const performancePenalty = fakeFlags
    .filter((f) => f.impact === "performance")
    .reduce((sum, f) => sum + f.penalty, 0);

  const engagementComponent = scoreFromRatio(erVsBenchmark);
  const consistencyComponent =
    scoreCadence(postsPerWeek) * 0.6 + scoreRecency(daysSinceLastPost) * 0.4;
  // Jangkauan: idealnya view >= 30% follower. View hanya dipakai bila
  // mencakup hampir seluruh sampel — kalau tidak, angkanya cuma mewakili
  // sebagian post (mis. akun Instagram yang isinya campuran carousel dan
  // Reels) dan tidak boleh menentukan nilai seluruh akun. Tanpa data yang
  // mewakili, komponen ini netral, bukan nol.
  const reachComponent =
    viewRate !== null && viewDataRepresentative
      ? clamp((viewRate / 30) * 100, 0, 100)
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
    postsPerWeek: round(postsPerWeek),
    daysSinceLastPost,
    score,
    verdict,
    authenticityScore,
    fakeFlags,
    sponsored,
    metrics: {
      erVsBenchmark: round(erVsBenchmark, 2),
      commentLikeRatio:
        commentLikeRatio === null ? null : round(commentLikeRatio, 4),
      engagementCv: engagementCv === null ? null : round(engagementCv, 3),
      engagementTrendPct:
        engagementTrendPct === null ? null : round(engagementTrendPct, 1),
      followingRatio: followingRatio === null ? null : round(followingRatio, 2),
      viralSkew: viralSkew === null ? null : round(viralSkew, 2),
      viewCoverage: viewCoverage === null ? null : round(viewCoverage, 2),
      viewSampleCount: viewsWithData.length,
      highAuthenticityFlags,
      expectedCampaignEr,
      expectedCampaignErSource: useSponsored ? "sponsored" : "overall",
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
