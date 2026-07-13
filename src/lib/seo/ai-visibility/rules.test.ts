import { describe, expect, it } from "vitest";
import {
  buildExcerpt,
  buildRunSummary,
  detectBrandMention,
} from "@/lib/seo/ai-visibility/rules";

describe("detectBrandMention", () => {
  it("matches brand name as whole word (case-insensitive)", () => {
    const res = detectBrandMention(
      "Rekomendasi serum: Glowify Serum dan brand lain.",
      [],
      ["glowify", "glowify.com"],
    );
    expect(res.mentioned).toBe(true);
    expect(res.matchedTerms).toContain("glowify");
  });

  it("does not match partial words", () => {
    const res = detectBrandMention(
      "Produk unglowifyable tidak relevan.",
      [],
      ["glowify"],
    );
    expect(res.mentioned).toBe(false);
  });

  it("matches domain in citations", () => {
    const res = detectBrandMention(
      "Beberapa sumber menyarankan produk lokal.",
      ["https://www.glowify.com/serum-niacinamide"],
      ["glowify.com"],
    );
    expect(res.mentioned).toBe(true);
    expect(res.matchedTerms).toEqual(["glowify.com"]);
  });

  it("returns false when nothing matches", () => {
    expect(
      detectBrandMention("Jawaban umum.", ["https://lain.com"], ["glowify"])
        .mentioned,
    ).toBe(false);
  });
});

describe("buildExcerpt", () => {
  it("centers around the first mention", () => {
    const text = `${"awal ".repeat(60)}Glowify adalah pilihan bagus ${"akhir ".repeat(60)}`;
    const excerpt = buildExcerpt(text, ["Glowify"]);
    expect(excerpt).toContain("Glowify");
    expect(excerpt.length).toBeLessThan(300);
  });

  it("falls back to the beginning", () => {
    expect(buildExcerpt("jawaban singkat", [])).toBe("jawaban singkat");
  });
});

describe("buildRunSummary", () => {
  it("aggregates per platform and skips errored checks", () => {
    const summary = buildRunSummary([
      { keyword: "a", platform: "chatgpt", prompt: "", mentioned: true, matchedTerms: [], excerpt: "", citations: [] },
      { keyword: "b", platform: "chatgpt", prompt: "", mentioned: false, matchedTerms: [], excerpt: "", citations: [] },
      { keyword: "a", platform: "perplexity", prompt: "", mentioned: true, matchedTerms: [], excerpt: "", citations: [] },
      { keyword: "c", platform: "perplexity", prompt: "", mentioned: false, matchedTerms: [], excerpt: "", citations: [], error: "timeout" },
    ]);
    expect(summary.totalChecks).toBe(3);
    expect(summary.mentionedChecks).toBe(2);
    expect(summary.mentionRate).toBe(67);
    expect(summary.byPlatform.chatgpt.rate).toBe(50);
    expect(summary.byPlatform.perplexity.rate).toBe(100);
  });
});
