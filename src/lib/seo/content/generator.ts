import "server-only";

import * as cheerio from "cheerio";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  buildResearchAiStep,
  generateResearchJson,
  mergeResearchAiMeta,
} from "@/lib/research/llm";
import {
  analyzeContent,
  type ContentAnalysisInput,
} from "@/lib/seo/content/content-score";
import {
  analyzeContentV2,
  hasUsableGrounding,
  type ScoreGrounding,
} from "@/lib/seo/content/content-score-v2";
import { extractSignalsFromHtml } from "@/lib/seo/content/html-signals-server";

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

/** Parse HTML editor TipTap menjadi input skoring konten. */
export function parseContentHtml(
  html: string,
  title: string,
  keyword: string | null,
): ContentAnalysisInput {
  const $ = cheerio.load(html);
  const text = $.root().text().replace(/\s+/g, " ").trim();
  const words = text ? text.split(/\s+/) : [];
  const wordCount = words.length;
  const sentences = text.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean);
  const avgWordsPerSentence = sentences.length ? wordCount / sentences.length : null;
  const firstParagraph = $("p").first().text().toLowerCase();

  let keywordCount = 0;
  let keywordInTitle = false;
  let keywordInFirstParagraph = false;
  if (keyword) {
    const kw = keyword.toLowerCase();
    keywordCount = countOccurrences(text.toLowerCase(), kw);
    keywordInTitle = title.toLowerCase().includes(kw);
    keywordInFirstParagraph = firstParagraph.includes(kw);
  }

  return {
    wordCount,
    keyword: keyword || null,
    keywordCount,
    keywordInTitle,
    keywordInFirstParagraph,
    h1Count: $("h1").length,
    h2Count: $("h2").length,
    avgWordsPerSentence,
  };
}

/* ---------------------------------- brief ---------------------------------- */

// Pipeline brief grounded SERP dipindah ke brief-pipeline.ts; re-export agar
// import dari actions tetap stabil.
export { generateContentBrief } from "@/lib/seo/content/brief-pipeline";

/* ---------------------------------- draft ---------------------------------- */

// Penulisan draft multi-step (resumable, grounded) ada di draft-writer.ts.

/* --------------------------------- analyze --------------------------------- */

/** Bangun grounding skoring dari row brief (dipakai analyze + editor). */
export function buildScoreGrounding(brief: {
  targetKeyword: string;
  terms: Prisma.JsonValue;
  paaQuestions: Prisma.JsonValue;
  targetWordCount: number | null;
  targetHeadings: number | null;
  outline: Prisma.JsonValue;
}): ScoreGrounding {
  return {
    targetKeyword: brief.targetKeyword,
    terms: Array.isArray(brief.terms)
      ? (brief.terms as unknown as ScoreGrounding["terms"])
      : [],
    paaQuestions: Array.isArray(brief.paaQuestions)
      ? (brief.paaQuestions as string[])
      : [],
    targetWordCount: brief.targetWordCount,
    targetHeadings: brief.targetHeadings,
    outline: Array.isArray(brief.outline)
      ? (brief.outline as { heading: string }[]).map((o) => ({
          heading: String(o.heading ?? ""),
        }))
      : [],
  };
}

export async function analyzeContentDraft(draftId: string): Promise<void> {
  const draft = await prisma.seoContentDraft.findUnique({ where: { id: draftId } });
  if (!draft) throw new Error("Draft tidak ditemukan.");

  const brief = draft.briefId
    ? await prisma.seoContentBrief.findUnique({ where: { id: draft.briefId } })
    : null;
  const grounding = brief ? buildScoreGrounding(brief) : null;

  const signals = extractSignalsFromHtml(draft.contentHtml);

  let score: number;
  let analysis: Record<string, unknown>;
  let failingLabels: string[];
  let termGaps: string[] = [];

  if (grounding && hasUsableGrounding(grounding) && draft.targetKeyword) {
    const v2 = analyzeContentV2(
      signals,
      {
        title: draft.title,
        metaTitle: draft.metaTitle,
        metaDescription: draft.metaDescription,
        slug: draft.slug,
      },
      grounding,
    );
    score = v2.score;
    failingLabels = v2.checks.filter((c) => !c.passed).map((c) => c.label);
    termGaps = v2.termReport
      .filter((t) => t.status === "missing" || t.status === "under")
      .slice(0, 12)
      .map((t) => t.term);
    analysis = {
      version: 2,
      categories: v2.categories,
      checks: v2.checks,
      termReport: v2.termReport,
      density: v2.density,
      structure: {
        wordCount: signals.wordCount,
        h1Count: signals.h1Count,
        h2Count: signals.h2Count,
        avgWordsPerSentence: signals.avgWordsPerSentence,
      },
      claims: signals.verifyMarkers,
    };
  } else {
    const input = parseContentHtml(
      draft.contentHtml,
      draft.title,
      draft.targetKeyword,
    );
    const v1 = analyzeContent(input);
    score = v1.score;
    failingLabels = v1.checks.filter((c) => !c.passed).map((c) => c.label);
    analysis = {
      version: 1,
      checks: v1.checks,
      density: v1.density,
      structure: {
        wordCount: input.wordCount,
        h1Count: input.h1Count,
        h2Count: input.h2Count,
        avgWordsPerSentence: input.avgWordsPerSentence,
      },
      claims: signals.verifyMarkers,
    };
  }

  // Saran + flag klaim berisiko BPOM dari LLM (best-effort).
  let suggestions: string[] = [];
  let claimWarnings: string[] = [];
  let aiMeta: object | undefined;
  try {
    const llm = await generateResearchJson<{
      suggestions?: string[];
      claimWarnings?: string[];
    }>(
      `Kamu reviewer SEO & kepatuhan klaim kosmetik Indonesia (BPOM). Draft "${draft.title}" (keyword: "${draft.targetKeyword ?? "-"}").
Skor: ${score}/100. Cek yang belum lulus: ${failingLabels.join(", ") || "-"}.
${termGaps.length ? `Istilah kompetitor yang belum/kurang terpakai: ${termGaps.join(", ")}.` : ""}
Kata: ${signals.wordCount}.

Cuplikan draft (awal):
${signals.text.slice(0, 2500)}

Tugas:
1. Beri 3-6 saran perbaikan spesifik & actionable (Bahasa Indonesia).
2. Daftar kalimat/klaim yang BERISIKO menurut etika iklan kosmetik BPOM (klaim medis/menyembuhkan/permanen/berlebihan). Kutip singkat kalimatnya. Kosongkan bila aman.

Balas HANYA JSON: { "suggestions": ["string"], "claimWarnings": ["string"] }`,
      { tier: "flash", validate: (r) => Array.isArray(r.suggestions) },
    );
    suggestions = Array.isArray(llm.suggestions)
      ? llm.suggestions.map((s) => String(s).trim()).filter(Boolean)
      : [];
    claimWarnings = Array.isArray(llm.claimWarnings)
      ? llm.claimWarnings.map((s) => String(s).trim()).filter(Boolean)
      : [];
    aiMeta = mergeResearchAiMeta(
      draft.aiMeta,
      buildResearchAiStep("SEO content review", "flash"),
    ) as object;
  } catch (err) {
    console.warn("[seo/content] saran LLM gagal (diabaikan)", err);
  }

  analysis.suggestions = suggestions;
  analysis.claimWarnings = claimWarnings;

  await prisma.seoContentDraft.update({
    where: { id: draftId },
    data: {
      score,
      analysis: analysis as unknown as Prisma.InputJsonValue,
      aiMeta: aiMeta ?? undefined,
    },
  });
}
