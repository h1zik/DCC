import { InfluencerPlatform, InfluencerTier } from "@prisma/client";
import type { NormalizedInfluencerProfile } from "@/lib/apify/normalize-influencer";
import { scoreInfluencer } from "@/lib/brand-research/influencer/score";

/**
 * Ubah profil ternormalisasi menjadi angka snapshot tingkat-1.
 *
 * Perhitungannya menumpang `scoreInfluencer()` yang sama dengan audit penuh,
 * bukan rumus sendiri — supaya ER snapshot dan ER audit punya definisi identik
 * dan boleh diperbandingkan antar kreator di halaman peringkat. Yang berbeda
 * cuma tebal sampelnya, dan itu dilaporkan apa adanya lewat `confidence`.
 *
 * Yang TIDAK diambil dari hasil skor: `verdict`, `authenticityScore`, dan
 * `fakeFlags`. Ketiganya lahir dari sampel 8 post di sini, terlalu tipis untuk
 * menuduh siapa pun — dan kalau ikut disimpan, cepat atau lambat vonis itu akan
 * tampil di layar seolah hasil audit sungguhan.
 */
export type SnapshotMetrics = {
  followers: number;
  following: number;
  postCount: number;
  tier: InfluencerTier | null;
  postsSampled: number;
  confidence: string;
  engagementRate: number | null;
  benchmarkEr: number | null;
  medianLikes: number;
  medianComments: number;
  medianViews: number;
  postsPerWeek: number | null;
  daysSinceLastPost: number | null;
};

export function buildSnapshotMetrics(
  platform: InfluencerPlatform,
  profile: NormalizedInfluencerProfile,
  now?: Date,
): SnapshotMetrics {
  // Tanpa follower, ER tidak punya penyebut — seluruh angka relatif jadi tak
  // bermakna, jadi yang dilaporkan hanya apa yang benar-benar terbaca.
  if (profile.followers <= 0 || profile.posts.length === 0) {
    return {
      followers: Math.max(profile.followers, 0),
      following: Math.max(profile.following, 0),
      postCount: Math.max(profile.postCount, 0),
      tier: null,
      postsSampled: profile.posts.length,
      confidence: "low",
      engagementRate: null,
      benchmarkEr: null,
      medianLikes: 0,
      medianComments: 0,
      medianViews: 0,
      postsPerWeek: null,
      daysSinceLastPost: null,
    };
  }

  const scored = scoreInfluencer({
    platform,
    followers: profile.followers,
    following: profile.following,
    posts: profile.posts,
    now,
  });

  return {
    followers: profile.followers,
    following: profile.following,
    postCount: Math.max(profile.postCount, profile.posts.length),
    tier: scored.tier,
    postsSampled: scored.postsAnalyzed,
    confidence: scored.confidence,
    // Nol di sini berarti "tidak terukur", bukan "tidak ada engagement" —
    // dibedakan lewat null supaya UI tidak melaporkan akun sehat sebagai mati.
    engagementRate: scored.metrics.engagementMeasurable
      ? scored.engagementRate
      : null,
    benchmarkEr: scored.benchmarkEr,
    medianLikes: scored.medianLikes,
    medianComments: scored.medianComments,
    medianViews: scored.medianViews,
    postsPerWeek: scored.postsPerWeek,
    daysSinceLastPost: scored.daysSinceLastPost,
  };
}
