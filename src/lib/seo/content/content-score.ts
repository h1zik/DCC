/**
 * Skoring SEO untuk draft konten. Pure (tanpa server) agar mudah di-test.
 * Analyzer menyiapkan input dari parsing HTML editor TipTap.
 */

export type ContentAnalysisInput = {
  wordCount: number;
  keyword: string | null;
  keywordCount: number;
  keywordInTitle: boolean;
  keywordInFirstParagraph: boolean;
  h1Count: number;
  h2Count: number;
  /** Rata-rata kata per kalimat (heuristik readability). */
  avgWordsPerSentence: number | null;
};

export type ContentCheck = {
  id: string;
  label: string;
  passed: boolean;
  weight: number;
  hint: string;
};

export type ContentAnalysis = {
  score: number;
  /** Densitas keyword 0-1 (mis. 0.012 = 1.2%). */
  density: number;
  checks: ContentCheck[];
};

const MIN_WORDS = 600;
const DENSITY_MIN = 0.003; // 0.3%
const DENSITY_MAX = 0.025; // 2.5%
const MAX_SENTENCE_WORDS = 20;

export function analyzeContent(input: ContentAnalysisInput): ContentAnalysis {
  const density =
    input.wordCount > 0 ? input.keywordCount / input.wordCount : 0;
  const hasKeyword = !!input.keyword;

  const checks: ContentCheck[] = [
    {
      id: "word_count",
      label: `Panjang konten ≥ ${MIN_WORDS} kata`,
      passed: input.wordCount >= MIN_WORDS,
      weight: 2,
      hint: `Saat ini ${input.wordCount} kata. Artikel SEO ideal ${MIN_WORDS}+ kata.`,
    },
    {
      id: "single_h1",
      label: "Tepat satu H1",
      passed: input.h1Count === 1,
      weight: 1,
      hint: "Gunakan satu H1 (judul utama) dan H2/H3 untuk subjudul.",
    },
    {
      id: "has_h2",
      label: "Minimal 2 subjudul (H2)",
      passed: input.h2Count >= 2,
      weight: 1,
      hint: "Pecah konten dengan beberapa H2 agar mudah dipindai.",
    },
    {
      id: "readability",
      label: `Kalimat ringkas (≤ ${MAX_SENTENCE_WORDS} kata/kalimat)`,
      passed:
        input.avgWordsPerSentence != null &&
        input.avgWordsPerSentence <= MAX_SENTENCE_WORDS,
      weight: 1,
      hint: "Kalimat pendek lebih mudah dibaca pembaca Indonesia.",
    },
  ];

  if (hasKeyword) {
    checks.push(
      {
        id: "keyword_in_title",
        label: "Keyword ada di judul",
        passed: input.keywordInTitle,
        weight: 2,
        hint: `Masukkan "${input.keyword}" ke judul (idealnya di awal).`,
      },
      {
        id: "keyword_in_intro",
        label: "Keyword ada di paragraf pembuka",
        passed: input.keywordInFirstParagraph,
        weight: 1,
        hint: "Sebut keyword utama di paragraf pertama.",
      },
      {
        id: "density",
        label: "Densitas keyword sehat (0.3%–2.5%)",
        passed: density >= DENSITY_MIN && density <= DENSITY_MAX,
        weight: 2,
        hint:
          density > DENSITY_MAX
            ? "Densitas terlalu tinggi (keyword stuffing). Kurangi pengulangan."
            : "Tambah penggunaan keyword secara natural.",
      },
    );
  }

  const totalWeight = checks.reduce((s, c) => s + c.weight, 0);
  const passedWeight = checks
    .filter((c) => c.passed)
    .reduce((s, c) => s + c.weight, 0);
  const score = totalWeight > 0 ? Math.round((passedWeight / totalWeight) * 100) : 0;

  return { score, density, checks };
}
