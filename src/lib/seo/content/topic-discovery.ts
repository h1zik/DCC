import "server-only";

import { Prisma, SeoAnalysisStatus, SeoKeywordIntent } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { DataForSeoError, isDataForSeoConfigured } from "@/lib/seo/dataforseo/client";
import { collectKeywordIdeas } from "@/lib/seo/dataforseo/keywords";
import { fetchSerpLive } from "@/lib/seo/dataforseo/serp";
import { rankByOpportunity } from "@/lib/seo/content/opportunity";
import {
  buildResearchAiStep,
  generateResearchJson,
  researchAiMetaFromSteps,
} from "@/lib/research/llm";

/** Jumlah keyword ideas yang ditarik dari DataForSEO. */
const IDEA_LIMIT = 60;
/** Kandidat teratas yang ditampilkan sebagai saran topik. */
const SHORTLIST = 10;
/** Kandidat teratas yang di-grounding dengan judul SERP nyata (kontrol biaya). */
const SERP_GROUNDING = 3;

export type TopicSuggestion = {
  keyword: string;
  searchVolume: number | null;
  difficulty: number | null;
  intent: SeoKeywordIntent;
  opportunityScore: number;
  suggestedTitle: string;
  angle: string | null;
  /** Judul yang sedang ranking di SERP (untuk kandidat ter-grounding). */
  competingTitles: string[];
};

function titleCase(text: string): string {
  return text
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/**
 * Jalankan Topic Discovery untuk satu seed: tarik keyword ideas, skor
 * opportunity, grounding judul dari SERP, lalu usulkan judul + angle (LLM).
 */
export async function runTopicDiscovery(runId: string): Promise<void> {
  const run = await prisma.seoContentTopicRun.findUnique({ where: { id: runId } });
  if (!run) throw new Error("Topic discovery tidak ditemukan.");

  if (!isDataForSeoConfigured()) {
    await prisma.seoContentTopicRun.update({
      where: { id: runId },
      data: {
        status: SeoAnalysisStatus.FAILED,
        errorMessage:
          "DataForSEO belum dikonfigurasi (set DATAFORSEO_LOGIN & DATAFORSEO_PASSWORD).",
      },
    });
    return;
  }

  await prisma.seoContentTopicRun.update({
    where: { id: runId },
    data: { status: SeoAnalysisStatus.COLLECTING, errorMessage: null, dataNotice: null },
  });

  try {
    const ideas = await collectKeywordIdeas(run.seed, { limit: IDEA_LIMIT });
    if (ideas.length === 0) {
      await prisma.seoContentTopicRun.update({
        where: { id: runId },
        data: {
          status: SeoAnalysisStatus.READY,
          suggestions: [] as unknown as Prisma.InputJsonValue,
          dataNotice: "Tidak ada keyword ditemukan untuk seed ini.",
        },
      });
      return;
    }

    await prisma.seoContentTopicRun.update({
      where: { id: runId },
      data: { status: SeoAnalysisStatus.ANALYZING },
    });

    const ranked = rankByOpportunity(ideas).slice(0, SHORTLIST);

    // Grounding: ambil judul yang sedang ranking untuk kandidat teratas.
    const competingTitlesByKeyword = new Map<string, string[]>();
    for (const cand of ranked.slice(0, SERP_GROUNDING)) {
      try {
        const lookup = await fetchSerpLive(cand.keyword);
        const titles = lookup.items
          .filter((i) => i.type === "organic" && i.title)
          .slice(0, 5)
          .map((i) => i.title!.trim());
        competingTitlesByKeyword.set(cand.keyword.toLowerCase(), titles);
      } catch (err) {
        console.warn("[seo/topic-discovery] SERP grounding gagal", cand.keyword, err);
      }
    }

    const titleByKeyword = await proposeTitles(
      run.seed,
      ranked,
      competingTitlesByKeyword,
    );

    const suggestions: TopicSuggestion[] = ranked.map((cand) => {
      const key = cand.keyword.toLowerCase();
      const proposed = titleByKeyword.get(key);
      return {
        keyword: cand.keyword,
        searchVolume: cand.searchVolume,
        difficulty: cand.difficulty,
        intent: cand.intent,
        opportunityScore: cand.opportunity.score,
        suggestedTitle: proposed?.title || titleCase(cand.keyword),
        angle: proposed?.angle ?? null,
        competingTitles: competingTitlesByKeyword.get(key) ?? [],
      };
    });

    await prisma.seoContentTopicRun.update({
      where: { id: runId },
      data: {
        status: SeoAnalysisStatus.READY,
        suggestions: suggestions as unknown as Prisma.InputJsonValue,
        aiMeta: titleByKeyword.size
          ? (researchAiMetaFromSteps([
              buildResearchAiStep("SEO topic discovery", "pro"),
            ]) as object)
          : undefined,
        errorMessage: null,
      },
    });
  } catch (err) {
    const message =
      err instanceof DataForSeoError
        ? err.balanceExhausted
          ? "Saldo DataForSEO habis — top up untuk melanjutkan discovery."
          : err.message
        : err instanceof Error
          ? err.message
          : "Topic discovery gagal.";
    await prisma.seoContentTopicRun.update({
      where: { id: runId },
      data: { status: SeoAnalysisStatus.FAILED, errorMessage: message },
    });
    throw err;
  }
}

export async function enqueueTopicDiscovery(runId: string): Promise<void> {
  await runTopicDiscovery(runId);
}

type ProposedTitle = { title: string; angle: string | null };

/**
 * Usulkan judul + angle per kandidat (LLM), grounding ke judul SERP nyata bila
 * tersedia. Fallback: judul title-case dari keyword bila LLM gagal.
 */
async function proposeTitles(
  seed: string,
  ranked: { keyword: string; searchVolume: number | null; difficulty: number | null; intent: SeoKeywordIntent }[],
  competing: Map<string, string[]>,
): Promise<Map<string, ProposedTitle>> {
  const list = ranked
    .map((c) => {
      const titles = competing.get(c.keyword.toLowerCase());
      const ground = titles?.length
        ? ` | judul yang sedang ranking: ${titles.slice(0, 3).join(" / ")}`
        : "";
      return `- ${c.keyword} (vol ${c.searchVolume ?? "?"}, difficulty ${c.difficulty ?? "?"}, intent ${c.intent.toLowerCase()})${ground}`;
    })
    .join("\n");

  const prompt = `Kamu adalah content strategist SEO untuk brand kosmetik/skincare Indonesia.
Seed/kategori: "${seed}".

Untuk SETIAP keyword di bawah, usulkan satu judul artikel SEO yang:
- memuat keyword secara natural, menonjol vs judul yang sedang ranking (kalau ada),
- menarik untuk pembaca Indonesia (tone hangat, kredibel), maksimal ~65 karakter.
Tambahkan "angle" singkat (1 kalimat) — sudut pandang yang membedakan.

Keyword:
${list}

Balas HANYA JSON valid:
{ "items": [{ "keyword": "string", "title": "string", "angle": "string" }] }`;

  const out = new Map<string, ProposedTitle>();
  try {
    const result = await generateResearchJson<{
      items?: { keyword?: string; title?: string; angle?: string }[];
    }>(prompt, { tier: "pro", validate: (r) => Array.isArray(r.items) });
    for (const item of result.items ?? []) {
      const key = String(item?.keyword ?? "").trim().toLowerCase();
      const title = String(item?.title ?? "").trim();
      if (key && title) {
        out.set(key, { title, angle: item?.angle?.trim() || null });
      }
    }
  } catch (err) {
    console.warn("[seo/topic-discovery] usulan judul LLM gagal (fallback)", err);
  }
  return out;
}
