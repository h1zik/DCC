/**
 * Menilai KUALITAS komentar, bukan hanya jumlahnya.
 *
 * Rasio komentar terhadap like tidak bisa membedakan 500 komentar berisi
 * pertanyaan produk dari 500 komentar "🔥🔥". Bagi brand, keduanya sangat
 * berbeda: yang pertama audiens yang benar-benar tertarik, yang kedua bisa
 * jadi paket komentar atau engagement pod.
 *
 * Analisis ini OPSIONAL: dataset Apify tidak selalu membawa contoh komentar.
 * Bila tidak ada, seluruh modul diam — ketiadaan data bukan bukti buruk.
 */

import type { NormalizedComment } from "@/lib/apify/normalize-influencer";

export type CommentQualityResult = {
  analyzedComments: number;
  postsWithComments: number;
  /** Komentar tanpa substansi: emoji saja, atau satu-dua kata generik. */
  lowSubstanceShare: number;
  /** Komentar yang teksnya persis sama dengan komentar lain di sampel. */
  duplicateShare: number;
  /** Komentar beraksara non-Latin (Sirilik, Arab, CJK) — indikasi comment farm. */
  foreignScriptShare: number;
  /** Komentar berpola jualan/spam ("cek bio", "wa 08…"). */
  spamShare: number;
  /** Komentar dari akun yang muncul di 3 post berbeda atau lebih. */
  repeatAuthorShare: number;
  /** Penulis unik ÷ komentar. Mendekati 1 = tiap komentar orang berbeda. */
  uniqueAuthorRatio: number | null;
};

/** Di bawah ini sampelnya terlalu kecil untuk menyimpulkan apa pun. */
export const MIN_COMMENTS_FOR_QUALITY = 25;

const EMOJI_ONLY_RE = /^[\p{Extended_Pictographic}\p{Emoji_Component}\s\p{P}]+$/u;
const FOREIGN_SCRIPT_RE = /[\p{Script=Cyrillic}\p{Script=Arabic}\p{Script=Han}\p{Script=Hangul}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Devanagari}\p{Script=Thai}]/u;

/**
 * Kata pujian satu-dua patah yang muncul sama saja entah kontennya bagus atau
 * tidak. Bukan berarti palsu — hanya tidak membuktikan ketertarikan apa pun.
 */
const FILLER_WORDS = new Set([
  "mantap", "mantul", "mantab", "keren", "bagus", "cakep", "cantik", "ganteng",
  "wow", "wah", "nice", "good", "great", "ok", "oke", "sip", "top", "kece",
  "suka", "love", "lucu", "amazing", "perfect", "gokil", "gila", "anjay",
  "wkwk", "wkwkwk", "haha", "hahaha", "hehe", "keren banget", "bagus banget",
  "mantap kali", "sukses terus", "semangat", "aamiin", "amin", "hadir",
  "pertamax", "first", "yes", "cool", "beautiful", "handsome", "so cute",
  "cute", "best", "wow keren", "the best",
]);

const SPAM_PATTERNS: RegExp[] = [
  /\bcek\s+(bio|profil|dm|pp)\b/u,
  /\blink\s+di\s+bio\b/u,
  /\bfollow\s*(me|back|balik)\b/u,
  /\bdm\s+(me|for|ya|admin)\b/u,
  /\bwa\s*0?8\d{6,}/u,
  /\b08\d{8,}\b/u,
  /\bjual\s+(murah|grosir)\b/u,
  /\bopen\s+(bo|order)\b/u,
  /\bpromo\s+(hari\s+ini|terbatas)\b/u,
  /\bklik\s+link\b/u,
  /\bmodal\s+kecil\b/u,
  /\bgacor\b/u,
];

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

/** Buang emoji & tanda baca supaya sisa kata bisa dihitung. */
function wordsOnly(text: string): string {
  return text
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isLowSubstanceComment(text: string): boolean {
  const raw = text.trim();
  if (!raw) return true;
  if (EMOJI_ONLY_RE.test(raw)) return true;

  const words = wordsOnly(normalize(raw));
  if (!words) return true;
  // Mention murni ("@teman") tidak mengatakan apa pun soal kontennya.
  if (/^@[\w.]+$/.test(raw)) return true;

  const tokens = words.split(" ");
  if (tokens.length <= 2) {
    // Satu-dua kata: substantif hanya kalau bukan pujian generik.
    return FILLER_WORDS.has(words) || tokens.every((t) => FILLER_WORDS.has(t));
  }
  return false;
}

export function isSpamComment(text: string): boolean {
  const normalized = normalize(text);
  return SPAM_PATTERNS.some((re) => re.test(normalized));
}

export type CommentQualityInput = {
  externalId: string;
  commentSamples?: NormalizedComment[];
};

/**
 * Hitung metrik kualitas komentar dari post yang membawa contoh komentar.
 * Mengembalikan null bila sampelnya terlalu tipis untuk disimpulkan.
 */
export function analyzeCommentQuality(
  posts: CommentQualityInput[],
): CommentQualityResult | null {
  const comments: { text: string; author?: string; postId: string }[] = [];
  let postsWithComments = 0;

  for (const post of posts) {
    const samples = post.commentSamples ?? [];
    if (samples.length === 0) continue;
    postsWithComments += 1;
    for (const c of samples) {
      if (c.text.trim()) {
        comments.push({ text: c.text, author: c.author, postId: post.externalId });
      }
    }
  }

  if (comments.length < MIN_COMMENTS_FOR_QUALITY) return null;

  let lowSubstance = 0;
  let foreign = 0;
  let spam = 0;
  const textCounts = new Map<string, number>();
  const authorPosts = new Map<string, Set<string>>();

  for (const c of comments) {
    if (isLowSubstanceComment(c.text)) lowSubstance += 1;
    if (FOREIGN_SCRIPT_RE.test(c.text)) foreign += 1;
    if (isSpamComment(c.text)) spam += 1;

    const key = normalize(c.text);
    textCounts.set(key, (textCounts.get(key) ?? 0) + 1);

    if (c.author) {
      const set = authorPosts.get(c.author) ?? new Set<string>();
      set.add(c.postId);
      authorPosts.set(c.author, set);
    }
  }

  const duplicates = [...textCounts.values()]
    .filter((n) => n > 1)
    .reduce((sum, n) => sum + n, 0);

  // Penulis yang muncul di banyak post berbeda: bisa penggemar setia, bisa
  // anggota pod. Jadi ini dilaporkan sebagai angka, bukan tuduhan.
  const withAuthor = comments.filter((c) => c.author);
  const repeatAuthors = new Set(
    [...authorPosts.entries()].filter(([, posts]) => posts.size >= 3).map(([a]) => a),
  );
  const repeatAuthorComments = withAuthor.filter(
    (c) => c.author && repeatAuthors.has(c.author),
  ).length;

  const share = (n: number) => Math.round((n / comments.length) * 1000) / 1000;

  return {
    analyzedComments: comments.length,
    postsWithComments,
    lowSubstanceShare: share(lowSubstance),
    duplicateShare: share(duplicates),
    foreignScriptShare: share(foreign),
    spamShare: share(spam),
    repeatAuthorShare:
      withAuthor.length > 0
        ? Math.round((repeatAuthorComments / withAuthor.length) * 1000) / 1000
        : 0,
    uniqueAuthorRatio:
      withAuthor.length > 0
        ? Math.round((authorPosts.size / withAuthor.length) * 1000) / 1000
        : null,
  };
}
