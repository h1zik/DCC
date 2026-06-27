import "server-only";

import * as cheerio from "cheerio";
import { Prisma, SeoAnalysisStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  buildResearchAiStep,
  generateResearchJson,
  generateResearchText,
  researchAiMetaFromSteps,
} from "@/lib/research/llm";
import {
  analyzeContent,
  type ContentAnalysisInput,
} from "@/lib/seo/content/content-score";

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

export async function generateContentBrief(briefId: string): Promise<void> {
  const brief = await prisma.seoContentBrief.findUnique({ where: { id: briefId } });
  if (!brief) throw new Error("Brief tidak ditemukan.");

  await prisma.seoContentBrief.update({
    where: { id: briefId },
    data: { status: SeoAnalysisStatus.ANALYZING, errorMessage: null },
  });

  const prompt = `Kamu adalah content strategist SEO untuk brand kosmetik/skincare Indonesia.
Buat brief artikel SEO untuk keyword target: "${brief.targetKeyword}".
Judul kerja: "${brief.title}".

Hasilkan:
1. related/long-tail keywords yang relevan (8-15).
2. outline artikel (H2/H3) dengan poin-poin tiap bagian.
3. angle/sudut pandang singkat agar konten menonjol (Bahasa Indonesia, tone hangat & kredibel).

Balas HANYA JSON valid:
{
  "relatedKeywords": ["string"],
  "outline": [{ "heading": "string", "points": ["string"] }],
  "angle": "string"
}`;

  try {
    const result = await generateResearchJson<{
      relatedKeywords?: string[];
      outline?: { heading?: string; points?: string[] }[];
      angle?: string;
    }>(prompt, {
      tier: "pro",
      validate: (r) => Array.isArray(r.outline) && r.outline.length > 0,
    });

    const relatedKeywords = Array.isArray(result.relatedKeywords)
      ? result.relatedKeywords.map((k) => String(k).trim()).filter(Boolean)
      : [];
    const outline = Array.isArray(result.outline)
      ? result.outline
          .filter((o) => o && typeof o.heading === "string")
          .map((o) => ({
            heading: String(o.heading).trim(),
            points: Array.isArray(o.points)
              ? o.points.map((p) => String(p).trim()).filter(Boolean)
              : [],
          }))
      : [];

    await prisma.seoContentBrief.update({
      where: { id: briefId },
      data: {
        status: SeoAnalysisStatus.READY,
        relatedKeywords: relatedKeywords as unknown as Prisma.InputJsonValue,
        outline: outline as unknown as Prisma.InputJsonValue,
        aiSummary: result.angle?.trim() || null,
        aiMeta: researchAiMetaFromSteps([
          buildResearchAiStep("SEO content brief", "pro"),
        ]) as object,
        errorMessage: null,
      },
    });
  } catch (err) {
    await prisma.seoContentBrief.update({
      where: { id: briefId },
      data: {
        status: SeoAnalysisStatus.FAILED,
        errorMessage: err instanceof Error ? err.message : "Gagal membuat brief.",
      },
    });
    throw err;
  }
}

/* ---------------------------------- draft ---------------------------------- */

type OutlineSection = { heading: string; points: string[] };

/** Tulis draft artikel HTML dari brief (LLM). Mengembalikan id draft baru. */
export async function generateDraftFromBrief(briefId: string): Promise<string> {
  const brief = await prisma.seoContentBrief.findUnique({ where: { id: briefId } });
  if (!brief) throw new Error("Brief tidak ditemukan.");

  const outline = Array.isArray(brief.outline)
    ? (brief.outline as OutlineSection[])
    : [];
  const related = Array.isArray(brief.relatedKeywords)
    ? (brief.relatedKeywords as string[])
    : [];

  const prompt = `Kamu adalah copywriter SEO untuk brand kosmetik/skincare Indonesia.
Tulis artikel lengkap (Bahasa Indonesia, tone hangat, kredibel, persuasif) untuk:
- Judul: "${brief.title}"
- Keyword target: "${brief.targetKeyword}"
- Related keywords: ${related.join(", ") || "-"}

Outline:
${outline.map((o) => `- ${o.heading}: ${o.points.join("; ")}`).join("\n") || "- (susun outline yang masuk akal)"}

Aturan penulisan:
- Mulai dengan satu <h1> judul, lalu paragraf pembuka yang memuat keyword target.
- Gunakan <h2>/<h3> untuk subjudul, <p> untuk paragraf, <ul><li> bila perlu.
- Minimal 600 kata, natural (hindari keyword stuffing).
- Balas HANYA HTML konten (tanpa <html>, <head>, atau <body>; tanpa blok markdown).`;

  const html = await generateResearchText(prompt, { tier: "pro" });
  const cleaned = html
    .replace(/^```html\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  const draft = await prisma.seoContentDraft.create({
    data: {
      briefId: brief.id,
      title: brief.title,
      targetKeyword: brief.targetKeyword,
      contentHtml: cleaned,
      createdById: brief.createdById,
      aiMeta: researchAiMetaFromSteps([
        buildResearchAiStep("SEO content draft", "pro"),
      ]) as object,
    },
  });
  return draft.id;
}

/* --------------------------------- analyze --------------------------------- */

export async function analyzeContentDraft(draftId: string): Promise<void> {
  const draft = await prisma.seoContentDraft.findUnique({ where: { id: draftId } });
  if (!draft) throw new Error("Draft tidak ditemukan.");

  const input = parseContentHtml(
    draft.contentHtml,
    draft.title,
    draft.targetKeyword,
  );
  const result = analyzeContent(input);

  // Saran tambahan dari LLM (best-effort).
  let suggestions: string[] = [];
  let aiMeta: object | undefined;
  try {
    const failing = result.checks.filter((c) => !c.passed).map((c) => c.label);
    const llm = await generateResearchJson<{ suggestions?: string[] }>(
      `Kamu reviewer SEO konten kosmetik Indonesia. Draft "${draft.title}" (keyword: "${draft.targetKeyword ?? "-"}").
Skor: ${result.score}/100. Cek yang belum lulus: ${failing.join(", ") || "-"}.
Kata: ${input.wordCount}, densitas keyword: ${(result.density * 100).toFixed(2)}%.

Beri 3-6 saran perbaikan spesifik & actionable (Bahasa Indonesia).
Balas HANYA JSON: { "suggestions": ["string"] }`,
      { tier: "flash", validate: (r) => Array.isArray(r.suggestions) },
    );
    suggestions = Array.isArray(llm.suggestions)
      ? llm.suggestions.map((s) => String(s).trim()).filter(Boolean)
      : [];
    aiMeta = researchAiMetaFromSteps([
      buildResearchAiStep("SEO content suggestions", "flash"),
    ]) as object;
  } catch (err) {
    console.warn("[seo/content] saran LLM gagal (diabaikan)", err);
  }

  const analysis = {
    checks: result.checks,
    density: result.density,
    structure: {
      wordCount: input.wordCount,
      h1Count: input.h1Count,
      h2Count: input.h2Count,
      avgWordsPerSentence: input.avgWordsPerSentence,
    },
    suggestions,
  };

  await prisma.seoContentDraft.update({
    where: { id: draftId },
    data: {
      score: result.score,
      analysis: analysis as unknown as Prisma.InputJsonValue,
      aiMeta: aiMeta ?? undefined,
    },
  });
}
