import { describe, expect, it } from "vitest";
import {
  buildExcerpt,
  buildFailureNotice,
  buildRunSummary,
  classifyAiVisibilityError,
  detectBrandMention,
  type AiVisibilityResult,
} from "@/lib/seo/ai-visibility/rules";

function result(
  overrides: Partial<AiVisibilityResult> & Pick<AiVisibilityResult, "platform">,
): AiVisibilityResult {
  return {
    keyword: "k",
    prompt: "",
    mentioned: false,
    matchedTerms: [],
    excerpt: "",
    citations: [],
    ...overrides,
  };
}

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

  it("matches subdomains of the brand domain in citations", () => {
    const res = detectBrandMention(
      "",
      ["https://shop.glowify.co/produk"],
      ["glowify.co"],
    );
    expect(res.mentioned).toBe(true);
  });

  it("does not match a longer TLD or a prefixed hostname (glowify.co vs glowify.com.au / notglowify.co)", () => {
    expect(
      detectBrandMention("", ["https://glowify.com.au/serum"], ["glowify.co"])
        .mentioned,
    ).toBe(false);
    expect(
      detectBrandMention("", ["https://notglowify.co/serum"], ["glowify.co"])
        .mentioned,
    ).toBe(false);
    expect(
      detectBrandMention("", ["https://www.glowify.com/x"], ["glowify.co"])
        .mentioned,
    ).toBe(false);
  });

  it("matches a domain mentioned in free text only on a boundary", () => {
    expect(
      detectBrandMention("Cek di glowify.co untuk detail.", [], ["glowify.co"])
        .mentioned,
    ).toBe(true);
    expect(
      detectBrandMention("Kunjungi www.glowify.co sekarang", [], ["glowify.co"])
        .mentioned,
    ).toBe(true);
    expect(
      detectBrandMention("Kunjungi glowify.co.id sekarang", [], ["glowify.co"])
        .mentioned,
    ).toBe(false);
    expect(
      detectBrandMention("Produk notglowify.co lain", [], ["glowify.co"])
        .mentioned,
    ).toBe(false);
    expect(
      detectBrandMention("Produk glowify.com.au lain", [], ["glowify.co"])
        .mentioned,
    ).toBe(false);
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
  it("aggregates per platform, excludes errored checks from the rate, and counts them separately", () => {
    const summary = buildRunSummary([
      result({ keyword: "a", platform: "chatgpt", mentioned: true }),
      result({ keyword: "b", platform: "chatgpt", mentioned: false }),
      result({ keyword: "a", platform: "perplexity", mentioned: true }),
      result({ keyword: "c", platform: "perplexity", error: "timeout", errorKind: "timeout" }),
    ]);
    expect(summary.totalChecks).toBe(3);
    expect(summary.mentionedChecks).toBe(2);
    expect(summary.failedChecks).toBe(1);
    expect(summary.mentionRate).toBe(67);
    expect(summary.byPlatform.chatgpt.rate).toBe(50);
    expect(summary.byPlatform.chatgpt.failed).toBe(0);
    expect(summary.byPlatform.perplexity.rate).toBe(100);
    expect(summary.byPlatform.perplexity.failed).toBe(1);
    expect(summary.byPlatform.perplexity.total).toBe(1);
  });

  it("keeps a platform entry when every check on it failed", () => {
    const summary = buildRunSummary([
      result({ platform: "gemini", error: "x", errorKind: "access" }),
      result({ platform: "gemini", error: "y", errorKind: "access" }),
    ]);
    expect(summary.totalChecks).toBe(0);
    expect(summary.failedChecks).toBe(2);
    expect(summary.mentionRate).toBe(0);
    expect(summary.byPlatform.gemini).toEqual({
      total: 0,
      mentioned: 0,
      rate: 0,
      failed: 2,
    });
  });

  it("counts checks that used a fallback model", () => {
    const summary = buildRunSummary([
      result({ platform: "claude", mentioned: true, modelFallback: true }),
      result({ platform: "claude", mentioned: false }),
    ]);
    expect(summary.fallbackChecks).toBe(1);
  });
});

describe("classifyAiVisibilityError", () => {
  it("buckets balance, access, timeout and other", () => {
    expect(classifyAiVisibilityError({ balanceExhausted: true, statusCode: 40200 })).toBe("balance");
    expect(classifyAiVisibilityError({ statusCode: 40201 })).toBe("access");
    expect(classifyAiVisibilityError({ statusCode: 40400 })).toBe("access");
    expect(classifyAiVisibilityError({ statusCode: 404 })).toBe("access");
    expect(classifyAiVisibilityError({ statusCode: 50000 })).toBe("other");
    expect(classifyAiVisibilityError({ message: "The operation was aborted due to timeout" })).toBe("timeout");
    expect(classifyAiVisibilityError({ message: "fetch failed" })).toBe("timeout");
    expect(classifyAiVisibilityError({ message: "sesuatu" })).toBe("other");
  });
});

describe("buildFailureNotice", () => {
  it("returns null when nothing failed", () => {
    expect(buildFailureNotice([result({ platform: "chatgpt", mentioned: true })])).toBeNull();
  });

  it("lists buckets with counts and mentions fallback models", () => {
    const notice = buildFailureNotice([
      result({ platform: "chatgpt", error: "a", errorKind: "balance" }),
      result({ platform: "gemini", error: "b", errorKind: "access" }),
      result({ platform: "gemini", error: "c", errorKind: "access" }),
      result({ platform: "claude", error: "d", errorKind: "timeout" }),
      result({ platform: "claude", mentioned: true, modelFallback: true }),
    ]);
    expect(notice).toContain("4 cek gagal");
    expect(notice).toContain("1 saldo DataForSEO habis");
    expect(notice).toContain("2 akses/endpoint");
    expect(notice).toContain("1 timeout/jaringan");
    expect(notice).toContain("1 cek memakai model fallback");
  });
});
