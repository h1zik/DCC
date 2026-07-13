import { describe, expect, it } from "vitest";
import {
  buildOriginalityReport,
  sampleDistinctiveSentences,
} from "@/lib/seo/content/originality";

const TEXT = `Niacinamide adalah salah satu bahan aktif paling populer dalam perawatan kulit modern. Apa itu niacinamide? Serum dengan kandungan niacinamide lima persen membantu menjaga skin barrier tetap sehat setiap hari. Ok. Pemakaian rutin di pagi hari sebaiknya selalu diikuti dengan sunscreen ber-SPF tiga puluh atau lebih. 123 456 789 000 111 222 333 444. Kulit kusam sering kali disebabkan oleh paparan sinar matahari dan kurangnya eksfoliasi yang teratur. Formula ringan ini mudah menyerap dan cocok untuk kulit berminyak maupun kombinasi tanpa rasa lengket.`;

describe("sampleDistinctiveSentences", () => {
  it("keeps only distinctive prose sentences", () => {
    const sampled = sampleDistinctiveSentences(TEXT, 10);
    expect(sampled.length).toBeGreaterThanOrEqual(4);
    expect(sampled.some((s) => s.includes("Apa itu niacinamide?"))).toBe(false);
    expect(sampled.some((s) => s.startsWith("123"))).toBe(false);
    expect(sampled.some((s) => s === "Ok.")).toBe(false);
  });

  it("spreads picks across the document when limited", () => {
    const sampled = sampleDistinctiveSentences(TEXT, 2);
    expect(sampled).toHaveLength(2);
    expect(sampled[0]).not.toBe(sampled[1]);
  });
});

describe("buildOriginalityReport", () => {
  it("scores by fraction of unmatched sentences", () => {
    const report = buildOriginalityReport(
      [
        { sentence: "a", matches: [] },
        { sentence: "b", matches: [{ url: "https://x.com", title: "X" }] },
        { sentence: "c", matches: [] },
        { sentence: "d", matches: [] },
      ],
      "2026-07-13T00:00:00Z",
    );
    expect(report.score).toBe(75);
    expect(report.matchedCount).toBe(1);
    expect(report.matches[0].url).toBe("https://x.com");
  });

  it("returns 100 for empty input", () => {
    expect(buildOriginalityReport([], "t").score).toBe(100);
  });
});
