import { describe, expect, it } from "vitest";
import {
  analyzeContentV2,
  hasUsableGrounding,
  isQuestionAnswered,
  type ScoreGrounding,
} from "@/lib/seo/content/content-score-v2";
import { extractSignalsFromHtml } from "@/lib/seo/content/html-signals-server";

const GROUNDING: ScoreGrounding = {
  targetKeyword: "serum niacinamide",
  terms: [
    { term: "kulit kusam", importance: 0.8, targetMin: 1, targetMax: 3 },
    { term: "skin barrier", importance: 0.6, targetMin: 1, targetMax: 2 },
    { term: "sunscreen", importance: 0.4, targetMin: 1, targetMax: 2 },
  ],
  paaQuestions: ["Apakah niacinamide aman untuk kulit sensitif?"],
  targetWordCount: 60,
  targetHeadings: 2,
  outline: [{ heading: "Manfaat Niacinamide" }, { heading: "Cara Pakai" }],
};

const META = {
  title: "Serum Niacinamide Terbaik",
  metaTitle: "Serum Niacinamide Terbaik untuk Kulit Kusam",
  metaDescription:
    "Rekomendasi serum niacinamide terbaik yang membantu merawat kulit kusam dan menjaga skin barrier, lengkap dengan cara pakainya.",
  slug: "serum-niacinamide-terbaik",
};

const GOOD_HTML = `
<h1>Serum Niacinamide Terbaik</h1>
<p>Serum niacinamide membantu merawat kulit kusam sejak pemakaian rutin. Pilihan tepat untuk rutinitas pagi.</p>
<h2>Manfaat Niacinamide untuk Kulit</h2>
<p>Niacinamide menjaga skin barrier dan membantu meratakan warna kulit kusam.</p>
<ul><li>Cocok dipadukan dengan sunscreen setiap pagi.</li></ul>
<h2>Cara Pakai yang Benar</h2>
<p>Gunakan setelah toner. Apakah niacinamide aman untuk kulit sensitif? Aman, mulai dari konsentrasi rendah.</p>
<p>Baca juga <a href="/blog/sunscreen-terbaik">rekomendasi sunscreen</a> dan <a href="https://sumber.org/niacinamide">studi bahan</a>.</p>
`;

describe("hasUsableGrounding", () => {
  it("detects usable grounding", () => {
    expect(hasUsableGrounding(GROUNDING)).toBe(true);
    expect(hasUsableGrounding(null)).toBe(false);
    expect(
      hasUsableGrounding({
        targetKeyword: "x",
        terms: [],
        paaQuestions: [],
        targetWordCount: null,
        targetHeadings: null,
        outline: [],
      }),
    ).toBe(false);
  });
});

describe("analyzeContentV2", () => {
  it("scores a well-optimized draft high", () => {
    const signals = extractSignalsFromHtml(GOOD_HTML);
    const result = analyzeContentV2(signals, META, GROUNDING);
    expect(result.score).toBeGreaterThanOrEqual(70);
    expect(result.categories.map((c) => c.id)).toEqual([
      "terms",
      "structure",
      "questions",
      "keyword_meta",
      "links",
      "readability",
    ]);
    const terms = result.termReport;
    expect(terms.find((t) => t.term === "kulit kusam")?.status).toBe("in_range");
    expect(terms.find((t) => t.term === "sunscreen")?.status).toBe("in_range");
  });

  it("scores an empty draft low and marks terms missing", () => {
    const signals = extractSignalsFromHtml("<p>pendek saja</p>");
    const result = analyzeContentV2(
      signals,
      { title: "x", metaTitle: null, metaDescription: null, slug: null },
      GROUNDING,
    );
    expect(result.score).toBeLessThan(30);
    expect(result.termReport.every((t) => t.status === "missing")).toBe(true);
  });

  it("penalizes unresolved verify markers", () => {
    const signals = extractSignalsFromHtml(
      GOOD_HTML + "<!-- verify: klaim uji klinis -->",
    );
    const withMarker = analyzeContentV2(signals, META, GROUNDING);
    const clean = analyzeContentV2(extractSignalsFromHtml(GOOD_HTML), META, GROUNDING);
    expect(withMarker.score).toBeLessThan(clean.score);
    expect(
      withMarker.checks.find((c) => c.id === "verify_markers")?.passed,
    ).toBe(false);
  });

  it("uses pendingClaims (aiMeta) instead of HTML markers when provided", () => {
    const signals = extractSignalsFromHtml(GOOD_HTML); // tanpa marker di HTML
    const withClaims = analyzeContentV2(signals, META, GROUNDING, {
      pendingClaims: ["klaim uji klinis"],
    });
    expect(
      withClaims.checks.find((c) => c.id === "verify_markers")?.passed,
    ).toBe(false);
    const resolved = analyzeContentV2(signals, META, GROUNDING, {
      pendingClaims: [],
    });
    expect(resolved.checks.find((c) => c.id === "verify_markers")?.passed).toBe(
      true,
    );
    // Daftar eksplisit kosong mengalahkan marker lama di HTML (sudah dipindah).
    const legacy = extractSignalsFromHtml(GOOD_HTML + "<!-- verify: x -->");
    expect(
      analyzeContentV2(legacy, META, GROUNDING, { pendingClaims: [] }).checks.find(
        (c) => c.id === "verify_markers",
      )?.passed,
    ).toBe(true);
  });

  it("requires PAA tokens to appear within a single heading or paragraph", () => {
    // Semua kata pertanyaan ada, tapi tersebar di paragraf berbeda.
    const scattered = `
<h1>Serum Niacinamide Terbaik</h1>
<p>Apakah serum ini cocok? Niacinamide populer.</p>
<p>Produk aman dipakai pagi.</p>
<p>Untuk kulit berminyak cocok.</p>
<p>Sensitif terhadap harga? Tenang.</p>`;
    const notAnswered = analyzeContentV2(
      extractSignalsFromHtml(scattered),
      META,
      GROUNDING,
    );
    expect(
      notAnswered.checks.find((c) => c.id === "paa_answered")?.label,
    ).toContain("(0/1)");

    const inHeading = scattered + "<h2>Apakah niacinamide aman untuk kulit sensitif?</h2>";
    const answered = analyzeContentV2(
      extractSignalsFromHtml(inHeading),
      META,
      GROUNDING,
    );
    expect(answered.checks.find((c) => c.id === "paa_answered")?.label).toContain(
      "(1/1)",
    );
    expect(isQuestionAnswered("apakah niacinamide aman untuk kulit sensitif", [
      "niacinamide aman untuk kulit sensitif bila dosis rendah",
    ])).toBe(true);
  });

  it("flags over-usage of terms", () => {
    const spam = GOOD_HTML + "<p>" + "kulit kusam ".repeat(10) + "</p>";
    const result = analyzeContentV2(
      extractSignalsFromHtml(spam),
      META,
      GROUNDING,
    );
    expect(result.termReport.find((t) => t.term === "kulit kusam")?.status).toBe(
      "over",
    );
  });
});
