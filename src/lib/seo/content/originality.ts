/**
 * Cek orisinalitas sederhana ala pemeriksa plagiarisme: sampel kalimat khas
 * dari draft → cari sebagai frasa persis ("...") di Google → bila ada hasil,
 * kalimat itu kemungkinan tersalin/tergenerasi identik dengan halaman lain.
 * Bagian pure (sampling + skor) dipisah agar mudah di-test.
 */

export type OriginalityMatch = {
  sentence: string;
  url: string;
  title: string | null;
};

export type OriginalityReport = {
  /** 0–100; 100 = tidak ada kalimat sampel yang ditemukan persis di web. */
  score: number;
  sampledCount: number;
  matchedCount: number;
  matches: OriginalityMatch[];
  checkedAt: string;
};

const MIN_WORDS = 8;
const MAX_WORDS = 22;
export const DEFAULT_SAMPLE_COUNT = 6;

/**
 * Pilih kalimat khas yang layak dicek: cukup panjang, bukan pertanyaan,
 * bukan daftar/angka, dan tersebar merata di seluruh dokumen.
 */
export function sampleDistinctiveSentences(
  text: string,
  count = DEFAULT_SAMPLE_COUNT,
): string[] {
  const sentences = text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => {
      const words = s.split(/\s+/);
      if (words.length < MIN_WORDS || words.length > MAX_WORDS) return false;
      if (s.endsWith("?")) return false;
      // Kalimat yang didominasi angka/simbol kurang khas.
      const alpha = s.replace(/[^a-zA-Zà-ÿ\s]/g, "").trim();
      if (alpha.split(/\s+/).length < words.length * 0.7) return false;
      return true;
    });

  if (sentences.length <= count) return sentences;

  // Ambil tersebar merata (bukan hanya bagian awal).
  const picked: string[] = [];
  const step = sentences.length / count;
  for (let i = 0; i < count; i++) {
    picked.push(sentences[Math.floor(i * step)]);
  }
  return picked;
}

/**
 * Normalisasi untuk pencocokan: lowercase, buang tanda baca/simbol, rapatkan
 * spasi. Dipakai pada kalimat sampel maupun title/description hasil SERP.
 */
export function normalizeForMatch(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Query frasa persis untuk Google: buang tanda kutip di kalimat lalu bungkus `"…"`. */
export function toExactPhraseQuery(sentence: string): string {
  const clean = sentence.replace(/["“”„‟«»]/g, "").replace(/\s+/g, " ").trim();
  return `"${clean}"`;
}

/**
 * Hasil SERP dihitung cocok hanya bila kalimat sampel (ternormalisasi) muncul
 * utuh di title atau description hasil tersebut — bukan sekadar Google
 * mengembalikan hasil "mirip" untuk pencarian frasa persis.
 */
export function sentenceAppearsIn(
  sentence: string,
  item: { title?: string | null; description?: string | null },
): boolean {
  const needle = normalizeForMatch(sentence);
  if (!needle) return false;
  const hay = normalizeForMatch(`${item.title ?? ""} ${item.description ?? ""}`);
  return hay.includes(needle);
}

export function buildOriginalityReport(
  results: { sentence: string; matches: { url: string; title: string | null }[] }[],
  checkedAt: string,
): OriginalityReport {
  const matched = results.filter((r) => r.matches.length > 0);
  const score =
    results.length === 0
      ? 100
      : Math.round(((results.length - matched.length) / results.length) * 100);
  return {
    score,
    sampledCount: results.length,
    matchedCount: matched.length,
    matches: matched.flatMap((r) =>
      r.matches.slice(0, 2).map((m) => ({
        sentence: r.sentence,
        url: m.url,
        title: m.title,
      })),
    ),
    checkedAt,
  };
}
