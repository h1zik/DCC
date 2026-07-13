import type { DocSignals } from "@/lib/seo/content/html-signals";
import type { ContentCheck } from "@/lib/seo/content/content-score";

/**
 * Skoring konten v2 ala Surfer/Semrush Writing Assistant: dinilai terhadap
 * data kompetitor dari brief (term coverage, struktur vs target median,
 * pertanyaan PAA, meta, link, readability Indonesia). Pure agar bisa jalan
 * real-time di editor (client) dan di server.
 */

export type ScoreTermInput = {
  term: string;
  importance: number;
  targetMin: number;
  targetMax: number;
};

export type ScoreGrounding = {
  targetKeyword: string;
  terms: ScoreTermInput[];
  paaQuestions: string[];
  targetWordCount: number | null;
  targetHeadings: number | null;
  outline: { heading: string }[];
};

export type ScoreMetaInput = {
  title: string;
  metaTitle: string | null;
  metaDescription: string | null;
  slug: string | null;
};

export type TermReportRow = {
  term: string;
  count: number;
  targetMin: number;
  targetMax: number;
  status: "missing" | "in_range" | "under" | "over";
};

export type ScoreCategory = {
  id: string;
  label: string;
  /** 0–100 dalam kategori. */
  score: number;
  /** Bobot kategori (jumlah semua = 100). */
  weight: number;
};

export type ContentAnalysisV2 = {
  score: number;
  categories: ScoreCategory[];
  checks: ContentCheck[];
  termReport: TermReportRow[];
  density: number;
};

const DENSITY_MIN = 0.003;
const DENSITY_MAX = 0.025;
const MAX_SENTENCE_WORDS = 20;
const MAX_PARAGRAPH_WORDS = 90;

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  let count = 0;
  let idx = haystack.indexOf(needle);
  while (idx !== -1) {
    count += 1;
    idx = haystack.indexOf(needle, idx + needle.length);
  }
  return count;
}

function tokenOverlapRatio(a: string, b: string): number {
  const ta = new Set(
    a.toLowerCase().split(/\W+/).filter((t) => t.length >= 3),
  );
  const tb = new Set(
    b.toLowerCase().split(/\W+/).filter((t) => t.length >= 3),
  );
  if (ta.size === 0) return 0;
  let hit = 0;
  for (const t of ta) if (tb.has(t)) hit++;
  return hit / ta.size;
}

/** Apakah grounding cukup berisi untuk skoring v2 (kalau tidak → fallback v1). */
export function hasUsableGrounding(g: ScoreGrounding | null): g is ScoreGrounding {
  if (!g) return false;
  return (
    g.terms.length > 0 ||
    g.paaQuestions.length > 0 ||
    g.targetWordCount != null ||
    g.outline.length > 0
  );
}

export function analyzeContentV2(
  signals: DocSignals,
  meta: ScoreMetaInput,
  grounding: ScoreGrounding,
): ContentAnalysisV2 {
  const textLower = signals.text.toLowerCase();
  const kw = grounding.targetKeyword.toLowerCase().trim();
  const kwCount = countOccurrences(textLower, kw);
  const density = signals.wordCount > 0 ? kwCount / signals.wordCount : 0;

  const checks: ContentCheck[] = [];
  const categories: ScoreCategory[] = [];

  /* ------------------------- 1. Term coverage (35%) ------------------------- */
  const termReport: TermReportRow[] = grounding.terms.map((t) => {
    const count = countOccurrences(textLower, t.term.toLowerCase());
    const status: TermReportRow["status"] =
      count === 0
        ? "missing"
        : count < t.targetMin
          ? "under"
          : count > t.targetMax
            ? "over"
            : "in_range";
    return {
      term: t.term,
      count,
      targetMin: t.targetMin,
      targetMax: t.targetMax,
      status,
    };
  });

  if (grounding.terms.length > 0) {
    let earned = 0;
    let totalWeight = 0;
    grounding.terms.forEach((t, i) => {
      const w = Math.max(0.1, t.importance);
      totalWeight += w;
      const row = termReport[i];
      earned +=
        row.status === "in_range" ? w : row.status === "missing" ? 0 : w * 0.5;
    });
    const termScore = totalWeight > 0 ? (earned / totalWeight) * 100 : 0;
    categories.push({
      id: "terms",
      label: "Cakupan istilah",
      score: Math.round(termScore),
      weight: 35,
    });
    const inRange = termReport.filter((r) => r.status === "in_range").length;
    checks.push({
      id: "term_coverage",
      label: `Istilah kompetitor terpakai (${inRange}/${grounding.terms.length} in-range)`,
      passed: termScore >= 60,
      weight: 3,
      hint: "Pakai istilah yang dipakai kompetitor ranking secara natural.",
    });
  }

  /* --------------------------- 2. Struktur (20%) ---------------------------- */
  {
    let pts = 0;
    let max = 0;

    // Word count vs target (partial credit 0.85–1.25x penuh).
    max += 2;
    if (grounding.targetWordCount) {
      const ratio = signals.wordCount / grounding.targetWordCount;
      pts +=
        ratio >= 0.85 && ratio <= 1.25
          ? 2
          : ratio >= 0.6
            ? 2 * clamp01((ratio - 0.35) / 0.5)
            : 0;
      checks.push({
        id: "word_count_target",
        label: `Panjang ~${grounding.targetWordCount} kata (median kompetitor)`,
        passed: ratio >= 0.85,
        weight: 2,
        hint: `Saat ini ${signals.wordCount} kata — target ${grounding.targetWordCount}.`,
      });
    } else {
      pts += signals.wordCount >= 600 ? 2 : 0;
      checks.push({
        id: "word_count",
        label: "Panjang konten ≥ 600 kata",
        passed: signals.wordCount >= 600,
        weight: 2,
        hint: `Saat ini ${signals.wordCount} kata.`,
      });
    }

    // Satu H1.
    max += 1;
    const oneH1 = signals.h1Count === 1;
    pts += oneH1 ? 1 : 0;
    checks.push({
      id: "single_h1",
      label: "Tepat satu H1",
      passed: oneH1,
      weight: 1,
      hint: "Gunakan satu H1 dan H2/H3 untuk subjudul.",
    });

    // Jumlah heading vs target.
    max += 1;
    const targetH = grounding.targetHeadings ?? 2;
    const enoughH = signals.h2Count >= Math.max(2, Math.min(targetH, 8));
    pts += enoughH ? 1 : signals.h2Count >= 2 ? 0.5 : 0;
    checks.push({
      id: "headings_target",
      label: `Subjudul H2 ≥ ${Math.max(2, Math.min(targetH, 8))}`,
      passed: enoughH,
      weight: 1,
      hint: "Pecah konten dengan subjudul agar mudah dipindai.",
    });

    // Cakupan outline brief (fuzzy token overlap).
    if (grounding.outline.length > 0) {
      max += 2;
      const headingTexts = signals.headings.map((h) => h.text);
      const covered = grounding.outline.filter((o) =>
        headingTexts.some((h) => tokenOverlapRatio(o.heading, h) >= 0.5),
      ).length;
      const ratio = covered / grounding.outline.length;
      pts += 2 * ratio;
      checks.push({
        id: "outline_coverage",
        label: `Outline brief tercakup (${covered}/${grounding.outline.length})`,
        passed: ratio >= 0.7,
        weight: 2,
        hint: "Bahas semua seksi yang direncanakan di brief.",
      });
    }

    categories.push({
      id: "structure",
      label: "Struktur",
      score: Math.round((pts / max) * 100),
      weight: 20,
    });
  }

  /* -------------------------- 3. Pertanyaan (15%) --------------------------- */
  if (grounding.paaQuestions.length > 0) {
    const headingAndText =
      signals.headings.map((h) => h.text).join(" ").toLowerCase() +
      " " +
      textLower;
    const answered = grounding.paaQuestions.filter(
      (q) => tokenOverlapRatio(q, headingAndText) >= 0.6,
    ).length;
    const ratio = answered / grounding.paaQuestions.length;
    categories.push({
      id: "questions",
      label: "Pertanyaan pencari",
      score: Math.round(ratio * 100),
      weight: 15,
    });
    checks.push({
      id: "paa_answered",
      label: `Pertanyaan PAA terjawab (${answered}/${grounding.paaQuestions.length})`,
      passed: ratio >= 0.5,
      weight: 2,
      hint: "Jawab pertanyaan People Also Ask di isi artikel atau FAQ.",
    });
  }

  /* ------------------------- 4. Keyword & meta (15%) ------------------------ */
  {
    let pts = 0;
    let max = 0;

    const add = (
      id: string,
      label: string,
      passed: boolean,
      hint: string,
      weight = 1,
    ) => {
      max += weight;
      pts += passed ? weight : 0;
      checks.push({ id, label, passed, weight, hint });
    };

    add(
      "keyword_in_title",
      "Keyword di judul",
      meta.title.toLowerCase().includes(kw),
      `Masukkan "${grounding.targetKeyword}" ke judul.`,
      2,
    );
    add(
      "keyword_in_intro",
      "Keyword di paragraf pembuka",
      signals.firstParagraph.toLowerCase().includes(kw),
      "Sebut keyword utama di paragraf pertama.",
    );
    add(
      "density",
      "Densitas keyword sehat (0.3%–2.5%)",
      density >= DENSITY_MIN && density <= DENSITY_MAX,
      density > DENSITY_MAX
        ? "Terlalu sering — kurangi pengulangan keyword."
        : "Tambah pemakaian keyword secara natural.",
      2,
    );
    add(
      "meta_title",
      "Meta title terisi (≤ 60 karakter, memuat keyword)",
      !!meta.metaTitle &&
        meta.metaTitle.length <= 60 &&
        meta.metaTitle.toLowerCase().includes(kw),
      "Isi meta title ≤ 60 karakter dengan keyword di depan.",
    );
    add(
      "meta_description",
      "Meta description 120–160 karakter",
      !!meta.metaDescription &&
        meta.metaDescription.length >= 120 &&
        meta.metaDescription.length <= 160,
      "Isi meta description 120–160 karakter yang persuasif.",
    );
    add(
      "slug",
      "Slug pendek memuat keyword",
      !!meta.slug && meta.slug.includes(kw.split(/\s+/)[0] ?? ""),
      "Gunakan slug kebab-case pendek yang memuat keyword.",
    );

    categories.push({
      id: "keyword_meta",
      label: "Keyword & meta",
      score: Math.round((pts / max) * 100),
      weight: 15,
    });
  }

  /* ------------------------------ 5. Link (5%) ------------------------------ */
  {
    const enoughLinks = signals.linkCount >= 2;
    const hasExternal = signals.externalLinkCount >= 1;
    const score = (enoughLinks ? 60 : signals.linkCount === 1 ? 30 : 0) +
      (hasExternal ? 40 : 0);
    categories.push({ id: "links", label: "Link", score, weight: 5 });
    checks.push({
      id: "links",
      label: "Minimal 2 link (internal/eksternal)",
      passed: enoughLinks,
      weight: 1,
      hint: "Tambahkan internal link ke halaman sendiri + 1 sumber eksternal kredibel.",
    });
  }

  /* --------------------------- 6. Readability (10%) -------------------------- */
  {
    let pts = 0;
    let max = 0;

    max += 1;
    const shortSentences =
      signals.avgWordsPerSentence != null &&
      signals.avgWordsPerSentence <= MAX_SENTENCE_WORDS;
    pts += shortSentences ? 1 : 0;
    checks.push({
      id: "readability",
      label: `Kalimat ringkas (≤ ${MAX_SENTENCE_WORDS} kata/kalimat)`,
      passed: shortSentences,
      weight: 1,
      hint: "Pecah kalimat panjang agar mudah dibaca.",
    });

    max += 1;
    const shortParagraphs =
      signals.maxParagraphWords > 0 &&
      signals.maxParagraphWords <= MAX_PARAGRAPH_WORDS;
    pts += shortParagraphs ? 1 : 0;
    checks.push({
      id: "paragraph_length",
      label: `Paragraf ringkas (≤ ${MAX_PARAGRAPH_WORDS} kata/paragraf)`,
      passed: shortParagraphs,
      weight: 1,
      hint: "Pecah paragraf raksasa jadi 2–3 paragraf.",
    });

    max += 1;
    const hasList = signals.listCount >= 1;
    pts += hasList ? 1 : 0;
    checks.push({
      id: "has_list",
      label: "Ada daftar (bullet/numbered)",
      passed: hasList,
      weight: 1,
      hint: "Gunakan list untuk poin-poin agar mudah dipindai.",
    });

    // Penalti verify-marker: klaim belum diverifikasi menurunkan skor.
    max += 1;
    const noMarkers = signals.verifyMarkers.length === 0;
    pts += noMarkers ? 1 : 0;
    checks.push({
      id: "verify_markers",
      label: "Tidak ada klaim menunggu verifikasi",
      passed: noMarkers,
      weight: 1,
      hint: `${signals.verifyMarkers.length} klaim ditandai <!-- verify --> — verifikasi lalu hapus markernya.`,
    });

    categories.push({
      id: "readability",
      label: "Keterbacaan",
      score: Math.round((pts / max) * 100),
      weight: 10,
    });
  }

  /* --------------------------------- Total --------------------------------- */
  const totalWeight = categories.reduce((s, c) => s + c.weight, 0);
  const score = Math.round(
    categories.reduce((s, c) => s + (c.score * c.weight) / 100, 0) /
      (totalWeight / 100),
  );

  return {
    score: Math.max(0, Math.min(100, score)),
    categories,
    checks,
    termReport,
    density,
  };
}
