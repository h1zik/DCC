/**
 * Deteksi post berbayar (endorse / paid partnership).
 *
 * Post berbayar hampir selalu mendapat engagement lebih rendah daripada post
 * organik dari akun yang sama. Untuk memutuskan kerja sama, angka yang relevan
 * adalah performa post berbayar — bukan rata-rata semua post.
 *
 * PENTING: hasil deteksi ini adalah BATAS BAWAH, bukan angka pasti. Banyak
 * influencer Indonesia tidak mencantumkan penanda berbayar sama sekali, jadi
 * sebagian post berbayar pasti lolos terhitung sebagai organik. UI wajib
 * menyampaikan keterbatasan ini.
 */

/** Hashtag penanda — dicocokkan utuh, bukan substring. */
const SPONSOR_HASHTAGS = new Set([
  "ad",
  "ads",
  "adv",
  "advertisement",
  "advertising",
  "sponsored",
  "sponsor",
  "sponsorship",
  "sponsoredpost",
  "paidpartnership",
  "paidpromotion",
  "paidpromote",
  "paidad",
  "endorse",
  "endorsed",
  "endorsement",
  "endorseby",
  "iklan",
  "kerjasama",
  "kerjasamaberbayar",
  "ambassador",
  "brandambassador",
  "gifted",
  "prpackage",
  "collab",
  "collaboration",
]);

/**
 * Frasa penanda. Sengaja dibatasi pada yang eksplisit — frasa longgar seperti
 * "terima kasih" atau "promosi" akan menghasilkan terlalu banyak positif palsu.
 */
const SPONSOR_PHRASES = [
  "paid partnership",
  "paid promotion",
  "sponsored by",
  "in partnership with",
  "kerja sama berbayar",
  "bekerja sama dengan",
  "dalam rangka kerja sama",
];

const HASHTAG_RE = /#([\p{L}\p{N}_]+)/gu;

export function extractHashtags(caption: string): string[] {
  const out: string[] = [];
  for (const match of caption.matchAll(HASHTAG_RE)) {
    out.push(match[1].toLowerCase());
  }
  return out;
}

export function isSponsoredCaption(caption: string | null | undefined): boolean {
  if (!caption) return false;
  const lower = caption.toLowerCase();

  for (const tag of extractHashtags(caption)) {
    if (SPONSOR_HASHTAGS.has(tag)) return true;
  }
  return SPONSOR_PHRASES.some((phrase) => lower.includes(phrase));
}

/**
 * Gabungkan penanda resmi dari platform (label "Paid partnership" Instagram,
 * `isAd` TikTok) dengan deteksi caption. Penanda platform lebih dipercaya;
 * caption menangkap sisanya.
 */
export function isSponsoredPost(post: {
  caption?: string | null;
  isSponsoredMeta?: boolean;
}): boolean {
  return post.isSponsoredMeta === true || isSponsoredCaption(post.caption);
}
