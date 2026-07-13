import "server-only";

import { Prisma, SeoAnalysisStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  DataForSeoError,
  isDataForSeoConfigured,
} from "@/lib/seo/dataforseo/client";
import { fetchSerpLive } from "@/lib/seo/dataforseo/serp";
import {
  extractPaaQuestions,
  extractRelatedSearches,
  extractTopOrganic,
  type SerpOrganicResult,
  type SerpRawItem,
} from "@/lib/seo/content/serp-extract";
import {
  fetchCompetitorPages,
  type CompetitorPage,
} from "@/lib/seo/content/competitor-fetch";
import {
  analyzeTerms,
  medianTargets,
  type SemanticTerm,
} from "@/lib/seo/content/term-analysis";
import {
  buildResearchAiStep,
  generateResearchJson,
  researchAiMetaFromSteps,
} from "@/lib/research/llm";

/**
 * Pipeline brief grounded SERP (ala Semrush SEO Content Template):
 *   A. COLLECTING — SERP top-10 + PAA + related searches + fetch halaman kompetitor.
 *   B. ANALYZING  — analisis term semantik + target median kompetitor.
 *   C. Outline grounded via LLM (fallback: brief LLM-only bila data SERP kosong).
 * Setiap step mem-persist hasilnya, jadi kegagalan LLM tidak membuang data SERP.
 */

/** Jumlah halaman organik teratas yang di-fetch untuk grounding. */
const COMPETITOR_FETCH_COUNT = 8;
/** Minimal halaman terbaca agar grounding dianggap memadai. */
const MIN_COMPETITOR_OK = 3;
/** Minimal kata agar halaman dihitung sebagai artikel (bukan halaman kosong). */
const MIN_COMPETITOR_WORDS = 150;

type OutlineSection = { heading: string; points: string[] };

type PersistedCompetitor = Omit<CompetitorPage, "bodyText">;

function stripBodyText(pages: CompetitorPage[]): PersistedCompetitor[] {
  return pages.map((p) => ({
    url: p.url,
    domain: p.domain,
    fetchStatus: p.fetchStatus,
    error: p.error,
    title: p.title,
    metaDescription: p.metaDescription,
    wordCount: p.wordCount,
    headings: p.headings,
  }));
}

async function setProgress(
  briefId: string,
  data: {
    status?: SeoAnalysisStatus;
    stepLabel?: string;
    percent?: number;
  },
): Promise<void> {
  await prisma.seoContentBrief.update({ where: { id: briefId }, data });
}

export async function generateContentBrief(briefId: string): Promise<void> {
  const brief = await prisma.seoContentBrief.findUnique({
    where: { id: briefId },
  });
  if (!brief) throw new Error("Brief tidak ditemukan.");

  await prisma.seoContentBrief.update({
    where: { id: briefId },
    data: {
      status: SeoAnalysisStatus.COLLECTING,
      stepLabel: "Mengambil data SERP…",
      percent: 10,
      errorMessage: null,
      dataNotice: null,
    },
  });

  try {
    /* ------------------------- Step A: SERP + kompetitor ------------------------ */
    let organic: SerpOrganicResult[] = [];
    let paaQuestions: string[] = [];
    let relatedSearches: string[] = [];
    let okPages: CompetitorPage[] = [];
    let competitorsPersist: PersistedCompetitor[] = [];
    const notices: string[] = [];

    if (isDataForSeoConfigured()) {
      const lookup = await fetchSerpLive(brief.targetKeyword);
      const raw = lookup.items as SerpRawItem[];
      organic = extractTopOrganic(raw, 10);
      paaQuestions = extractPaaQuestions(raw);
      relatedSearches = extractRelatedSearches(raw);

      await setProgress(briefId, {
        stepLabel: "Membaca halaman kompetitor…",
        percent: 25,
      });

      const pages = await fetchCompetitorPages(
        organic.slice(0, COMPETITOR_FETCH_COUNT).map((o) => o.url),
      );
      competitorsPersist = stripBodyText(pages);
      okPages = pages.filter(
        (p) => p.fetchStatus === "ok" && p.wordCount >= MIN_COMPETITOR_WORDS,
      );
      if (okPages.length < MIN_COMPETITOR_OK) {
        notices.push(
          okPages.length === 0
            ? "Tidak ada halaman kompetitor yang terbaca — brief memakai pengetahuan LLM saja."
            : `Grounding terbatas: hanya ${okPages.length} halaman kompetitor terbaca.`,
        );
      }
    } else {
      notices.push(
        "DataForSEO belum dikonfigurasi — brief memakai pengetahuan LLM saja.",
      );
    }

    /* --------------------------- Step B: analisis term -------------------------- */
    await setProgress(briefId, {
      status: SeoAnalysisStatus.ANALYZING,
      stepLabel: "Menganalisis term & target…",
      percent: 45,
    });

    const terms: SemanticTerm[] = analyzeTerms(
      okPages.map((p) => p.bodyText),
      { targetKeyword: brief.targetKeyword },
    );
    const targets =
      okPages.length > 0
        ? medianTargets(
            okPages.map((p) => ({
              wordCount: p.wordCount,
              headingsCount: p.headings.length,
            })),
          )
        : null;

    await prisma.seoContentBrief.update({
      where: { id: briefId },
      data: {
        serpData: organic as unknown as Prisma.InputJsonValue,
        paaQuestions: paaQuestions as unknown as Prisma.InputJsonValue,
        relatedSearches: relatedSearches as unknown as Prisma.InputJsonValue,
        competitors: competitorsPersist as unknown as Prisma.InputJsonValue,
        terms: terms as unknown as Prisma.InputJsonValue,
        targetWordCount: targets?.targetWordCount ?? null,
        targetHeadings: targets?.targetHeadings ?? null,
        stepLabel: "Menyusun outline…",
        percent: 70,
      },
    });

    /* --------------------------- Step C: outline (LLM) -------------------------- */
    const grounded = okPages.length > 0;
    const result = await generateOutline(brief.title, brief.targetKeyword, {
      grounded,
      organic,
      okPages,
      paaQuestions,
      relatedSearches,
      terms,
      targetWordCount: targets?.targetWordCount ?? null,
    });

    // Related keywords: gabungan related searches + usulan LLM (unik).
    const relatedKeywords: string[] = [];
    const seen = new Set<string>();
    for (const kw of [...relatedSearches, ...result.relatedKeywords]) {
      const key = kw.toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      relatedKeywords.push(kw);
    }

    await prisma.seoContentBrief.update({
      where: { id: briefId },
      data: {
        status: SeoAnalysisStatus.READY,
        relatedKeywords: relatedKeywords as unknown as Prisma.InputJsonValue,
        outline: result.outline as unknown as Prisma.InputJsonValue,
        aiSummary: result.angle,
        aiMeta: researchAiMetaFromSteps([
          buildResearchAiStep(
            grounded ? "SEO content brief (SERP-grounded)" : "SEO content brief",
            "pro",
          ),
        ]) as object,
        dataNotice: notices.length ? notices.join(" ") : null,
        stepLabel: null,
        percent: 100,
        errorMessage: null,
      },
    });
  } catch (err) {
    const message =
      err instanceof DataForSeoError
        ? err.balanceExhausted
          ? "Saldo DataForSEO habis — top up untuk melanjutkan pembuatan brief."
          : err.message
        : err instanceof Error
          ? err.message
          : "Gagal membuat brief.";
    await prisma.seoContentBrief.update({
      where: { id: briefId },
      data: {
        status: SeoAnalysisStatus.FAILED,
        errorMessage: message,
        stepLabel: null,
      },
    });
    throw err;
  }
}

type OutlineResult = {
  relatedKeywords: string[];
  outline: OutlineSection[];
  angle: string | null;
};

async function generateOutline(
  title: string,
  targetKeyword: string,
  ctx: {
    grounded: boolean;
    organic: SerpOrganicResult[];
    okPages: CompetitorPage[];
    paaQuestions: string[];
    relatedSearches: string[];
    terms: SemanticTerm[];
    targetWordCount: number | null;
  },
): Promise<OutlineResult> {
  const groundingBlock = ctx.grounded
    ? `
DATA SERP NYATA (Google Indonesia):

Judul yang sedang ranking:
${ctx.organic
  .slice(0, 10)
  .map((o) => `${o.rank}. ${o.title} (${o.domain})`)
  .join("\n")}

Struktur heading kompetitor:
${ctx.okPages
  .slice(0, 5)
  .map(
    (p) =>
      `- ${p.domain} (${p.wordCount} kata): ${p.headings
        .slice(0, 10)
        .map((h) => (h.level === 2 ? `H2:${h.text}` : `H3:${h.text}`))
        .join(" | ")}`,
  )
  .join("\n")}

Pertanyaan yang sering dicari (People Also Ask):
${ctx.paaQuestions.slice(0, 8).map((q) => `- ${q}`).join("\n") || "- (tidak ada)"}

Istilah penting yang dipakai kompetitor:
${ctx.terms.slice(0, 20).map((t) => t.term).join(", ") || "-"}
${ctx.targetWordCount ? `\nTarget panjang artikel: ~${ctx.targetWordCount} kata (median kompetitor +10%).` : ""}

Outline HARUS: mencakup topik-topik yang dibahas kompetitor, menambah minimal satu seksi diferensiator yang belum dibahas kompetitor, dan diakhiri satu seksi FAQ dari pertanyaan People Also Ask di atas.`
    : "";

  const prompt = `Kamu adalah content strategist SEO untuk brand kosmetik/skincare Indonesia.
Buat brief artikel SEO untuk keyword target: "${targetKeyword}".
Judul kerja: "${title}".
${groundingBlock}

Aturan klaim (WAJIB): hindari klaim medis/menyembuhkan (sensitif BPOM) — gunakan bahasa "membantu", "menjaga", "merawat".

Hasilkan:
1. related/long-tail keywords yang relevan (8-15).
2. outline artikel (H2/H3) dengan poin-poin tiap bagian.
3. angle/sudut pandang singkat agar konten menonjol vs yang sudah ranking (Bahasa Indonesia, tone hangat & kredibel).

Balas HANYA JSON valid:
{
  "relatedKeywords": ["string"],
  "outline": [{ "heading": "string", "points": ["string"] }],
  "angle": "string"
}`;

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

  return {
    relatedKeywords,
    outline,
    angle: result.angle?.trim() || null,
  };
}
