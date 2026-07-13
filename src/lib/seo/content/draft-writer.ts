import "server-only";

import { Prisma, SeoAnalysisStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  buildResearchAiStep,
  generateResearchJson,
  generateResearchText,
  researchAiMetaFromSteps,
  type ResearchAiModelStep,
} from "@/lib/research/llm";
import {
  planDraftSections,
  splitBatchHtml,
  tailWords,
  type OutlineSection,
  type PlannedSection,
} from "@/lib/seo/content/draft-plan";
import {
  suggestInternalLinks,
  type LinkCandidate,
} from "@/lib/seo/content/internal-links";
import { slugify } from "@/lib/seo/content/slug";
import type { SemanticTerm } from "@/lib/seo/content/term-analysis";
import { analyzeContentDraft } from "@/lib/seo/content/generator";

/**
 * Pipeline penulisan artikel multi-step & resumable:
 *   1. Rencana section (budget kata + alokasi term) → sectionsJson.
 *   2. Tulis section per batch (Gemini pro) — tiap batch dipersist → crash-safe.
 *   3. FAQ dari People Also Ask.
 *   4. Saran internal link (tanpa LLM, dari data ranking sendiri).
 *   5. Meta title/description/slug (flash; fallback pure).
 *   6. Assemble contentHtml + analisis skor → READY.
 * `resumeDraftGeneration` cukup memanggil ulang `writeDraftFromBrief` — step
 * yang sudah selesai dilewati.
 */

const SECTIONS_PER_CALL = 2;
const FAQ_QUESTION_COUNT = 6;

/** Aturan trust untuk konten kosmetik Indonesia — dipakai di semua prompt penulisan. */
const TRUST_RULES = `Aturan WAJIB:
- Konten kosmetik/skincare Indonesia — patuhi etika klaim BPOM: DILARANG klaim menyembuhkan/menghilangkan permanen/klaim medis. Gunakan "membantu", "menjaga", "merawat".
- JANGAN mengarang angka, persentase, nama studi, atau kutipan ahli. Bila menyebut fakta ilmiah umum, tulis konservatif tanpa sitasi palsu.
- Bila ada klaim yang sebaiknya diverifikasi manusia, sisipkan komentar HTML persis: <!-- verify: alasan singkat -->.
- Output HANYA HTML konten (tanpa <html>/<head>/<body>, tanpa blok markdown).`;

type BriefRow = NonNullable<
  Awaited<ReturnType<typeof prisma.seoContentBrief.findUnique>>
>;

function parseSections(raw: Prisma.JsonValue | null): PlannedSection[] {
  return Array.isArray(raw) ? (raw as unknown as PlannedSection[]) : [];
}

async function persistSections(
  draftId: string,
  sections: PlannedSection[],
  extra: { stepLabel?: string; percent?: number } = {},
): Promise<void> {
  await prisma.seoContentDraft.update({
    where: { id: draftId },
    data: {
      sectionsJson: sections as unknown as Prisma.InputJsonValue,
      ...extra,
    },
  });
}

/** Buat row draft baru (PENDING) untuk brief — pipeline dijalankan terpisah. */
export async function createDraftForBrief(briefId: string): Promise<string> {
  const brief = await prisma.seoContentBrief.findUnique({ where: { id: briefId } });
  if (!brief) throw new Error("Brief tidak ditemukan.");

  const draft = await prisma.seoContentDraft.create({
    data: {
      briefId: brief.id,
      title: brief.title,
      targetKeyword: brief.targetKeyword,
      contentHtml: "",
      status: SeoAnalysisStatus.PENDING,
      stepLabel: "Menunggu antrian…",
      percent: 0,
      createdById: brief.createdById,
    },
  });
  return draft.id;
}

export async function writeDraftFromBrief(draftId: string): Promise<void> {
  const draft = await prisma.seoContentDraft.findUnique({ where: { id: draftId } });
  if (!draft) throw new Error("Draft tidak ditemukan.");
  if (!draft.briefId) throw new Error("Draft ini tidak terhubung ke brief.");
  const brief = await prisma.seoContentBrief.findUnique({
    where: { id: draft.briefId },
  });
  if (!brief) throw new Error("Brief tidak ditemukan.");

  const aiSteps: ResearchAiModelStep[] = [];

  await prisma.seoContentDraft.update({
    where: { id: draftId },
    data: {
      status: SeoAnalysisStatus.ANALYZING,
      errorMessage: null,
    },
  });

  try {
    /* ------------------------------ 1. Rencana ------------------------------ */
    let sections = parseSections(draft.sectionsJson);
    const paaQuestions = Array.isArray(brief.paaQuestions)
      ? (brief.paaQuestions as string[])
      : [];
    if (sections.length === 0) {
      const outline = Array.isArray(brief.outline)
        ? (brief.outline as OutlineSection[])
        : [];
      const terms = Array.isArray(brief.terms)
        ? (brief.terms as unknown as SemanticTerm[])
        : [];
      sections = planDraftSections(outline, terms, brief.targetWordCount, {
        hasFaq: paaQuestions.length > 0,
      });
      await persistSections(draftId, sections, {
        stepLabel: "Merencanakan artikel…",
        percent: 5,
      });
    }

    /* --------------------------- 2. Tulis section --------------------------- */
    const pendingIdx = () => sections.findIndex((s) => !s.done);
    const totalSections = sections.length;

    while (pendingIdx() !== -1) {
      const start = pendingIdx();
      const batch = sections
        .slice(start, start + SECTIONS_PER_CALL)
        .filter((s) => !s.done);

      const doneCount = sections.filter((s) => s.done).length;
      const percent = 10 + Math.round((doneCount / totalSections) * 60);
      await persistSections(draftId, sections, {
        stepLabel: `Menulis: ${batch[0].heading ?? "paragraf pembuka"}…`,
        percent,
      });

      const written = await writeSectionBatch(brief, draft.title, sections, batch);
      aiSteps.push(buildResearchAiStep("SEO draft sections", "pro"));

      for (const w of written) {
        const target = sections.find((s) => s.id === w.id);
        if (target) {
          target.html = w.html;
          target.done = true;
        }
      }
      await persistSections(draftId, sections);
    }

    /* -------------------------------- 3. FAQ -------------------------------- */
    let faqHtml = "";
    const existingFaq = sections.find((s) => s.id === "faq");
    if (existingFaq?.html) {
      faqHtml = existingFaq.html;
    } else if (paaQuestions.length > 0) {
      await persistSections(draftId, sections, {
        stepLabel: "Menulis FAQ…",
        percent: 75,
      });
      faqHtml = await writeFaq(brief, paaQuestions);
      if (faqHtml) {
        aiSteps.push(buildResearchAiStep("SEO draft FAQ", "pro"));
        sections.push({
          id: "faq",
          heading: "FAQ",
          points: [],
          terms: [],
          wordBudget: 0,
          html: faqHtml,
          done: true,
        });
        await persistSections(draftId, sections);
      }
    }

    /* --------------------------- 4. Internal links -------------------------- */
    if (draft.internalLinks == null) {
      await prisma.seoContentDraft.update({
        where: { id: draftId },
        data: { stepLabel: "Mencari internal link…", percent: 82 },
      });
      const links = await buildInternalLinkSuggestions(brief);
      await prisma.seoContentDraft.update({
        where: { id: draftId },
        data: { internalLinks: links as unknown as Prisma.InputJsonValue },
      });
    }

    /* -------------------------------- 5. Meta ------------------------------- */
    const current = await prisma.seoContentDraft.findUnique({
      where: { id: draftId },
      select: { metaTitle: true },
    });
    if (!current?.metaTitle) {
      await prisma.seoContentDraft.update({
        where: { id: draftId },
        data: { stepLabel: "Menyusun meta…", percent: 90 },
      });
      const meta = await writeMeta(brief, draft.title);
      if (meta.usedLlm) aiSteps.push(buildResearchAiStep("SEO draft meta", "flash"));
      await prisma.seoContentDraft.update({
        where: { id: draftId },
        data: {
          metaTitle: meta.metaTitle,
          metaDescription: meta.metaDescription,
          slug: meta.slug,
        },
      });
    }

    /* ------------------------------ 6. Assemble ----------------------------- */
    const bodyHtml = sections
      .filter((s) => s.id !== "faq")
      .map((s) => s.html ?? "")
      .join("\n");
    const contentHtml = [`<h1>${escapeHtml(draft.title)}</h1>`, bodyHtml, faqHtml]
      .filter(Boolean)
      .join("\n");

    await prisma.seoContentDraft.update({
      where: { id: draftId },
      data: {
        contentHtml,
        status: SeoAnalysisStatus.READY,
        stepLabel: null,
        percent: 100,
        aiMeta: researchAiMetaFromSteps(aiSteps) as object,
        errorMessage: null,
      },
    });

    // Skoring awal (best-effort — kegagalan tidak menggagalkan draft).
    try {
      await analyzeContentDraft(draftId);
    } catch (err) {
      console.warn("[seo/draft-writer] analisis awal gagal (diabaikan)", err);
    }
  } catch (err) {
    await prisma.seoContentDraft.update({
      where: { id: draftId },
      data: {
        status: SeoAnalysisStatus.FAILED,
        errorMessage:
          err instanceof Error ? err.message : "Penulisan draft gagal.",
        stepLabel: null,
      },
    });
    throw err;
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function cleanLlmHtml(html: string): string {
  return html
    .replace(/^```(?:html)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
}

/* ------------------------------ section batch ------------------------------ */

async function writeSectionBatch(
  brief: BriefRow,
  title: string,
  allSections: PlannedSection[],
  batch: PlannedSection[],
): Promise<{ id: string; html: string }[]> {
  const doneSections = allSections.filter((s) => s.done && s.html);
  const previousTail =
    doneSections.length > 0
      ? tailWords(doneSections[doneSections.length - 1].html ?? "", 150)
      : "";

  const sectionSpecs = batch
    .map((s) => {
      const heading = s.heading
        ? `Section (H2): "${s.heading}"`
        : "Paragraf pembuka (TANPA heading — langsung <p>)";
      const points = s.points.length
        ? `\n  Poin yang harus dibahas: ${s.points.join("; ")}`
        : "";
      const terms = s.terms.length
        ? `\n  Gunakan istilah berikut secara natural (jangan dipaksakan): ${s.terms.join(", ")}`
        : "";
      return `- ${heading}${points}${terms}\n  Panjang: ~${s.wordBudget} kata.`;
    })
    .join("\n");

  const prompt = `Kamu adalah copywriter SEO senior untuk brand kosmetik/skincare Indonesia.
Artikel: "${title}" — keyword target: "${brief.targetKeyword}".
Tone: hangat, kredibel, membumi, Bahasa Indonesia.

${previousTail ? `Konteks — akhir bagian sebelumnya (JANGAN diulang, lanjutkan mengalir):\n"…${previousTail}"\n` : ""}
Tulis bagian berikut:
${sectionSpecs}

Format tiap section: ${batch.some((s) => s.heading) ? '<h2>Judul Section</h2> lalu <p>/<ul>. Gunakan <h3> untuk sub-poin bila perlu.' : "hanya <p> (tanpa heading)."}
${TRUST_RULES}`;

  const attempt = async (): Promise<string> => {
    const html = cleanLlmHtml(await generateResearchText(prompt, { tier: "pro" }));
    if (!html || html.length < 100) throw new Error("Output section kosong/terlalu pendek.");
    const needH2 = batch.filter((s) => s.heading).length;
    const gotH2 = (html.match(/<h2[\s>]/gi) ?? []).length;
    if (needH2 > 0 && gotH2 === 0) {
      throw new Error("Output tidak memuat heading yang diminta.");
    }
    return html;
  };

  let html: string;
  try {
    html = await attempt();
  } catch {
    html = await attempt(); // retry sekali
  }

  return splitBatchHtml(html, batch);
}

/* ---------------------------------- FAQ ---------------------------------- */

async function writeFaq(brief: BriefRow, questions: string[]): Promise<string> {
  const list = questions.slice(0, FAQ_QUESTION_COUNT);
  const prompt = `Kamu adalah copywriter SEO untuk brand kosmetik/skincare Indonesia.
Tulis seksi FAQ artikel "${brief.title}" (keyword: "${brief.targetKeyword}").

Jawab pertanyaan berikut (ini pertanyaan nyata dari Google "People Also Ask"):
${list.map((q) => `- ${q}`).join("\n")}

Format: <h2>Pertanyaan yang Sering Diajukan</h2> lalu per pertanyaan: <h3>pertanyaan</h3><p>jawaban 40-80 kata</p>.
${TRUST_RULES}`;

  try {
    const html = cleanLlmHtml(await generateResearchText(prompt, { tier: "pro" }));
    return html.length >= 100 ? html : "";
  } catch (err) {
    console.warn("[seo/draft-writer] FAQ gagal (dilewati)", err);
    return "";
  }
}

/* ----------------------------- internal links ----------------------------- */

async function buildInternalLinkSuggestions(brief: BriefRow) {
  const [tracked, audits] = await Promise.all([
    prisma.seoTrackedKeyword.findMany({
      where: { lastFoundUrl: { not: null } },
      select: { keyword: true, lastFoundUrl: true },
      take: 500,
    }),
    prisma.seoOnPageAudit.findMany({
      select: { url: true, targetKeyword: true },
      take: 200,
    }),
  ]);

  const candidates: LinkCandidate[] = [
    ...tracked.map((t) => ({ url: t.lastFoundUrl!, keyword: t.keyword })),
    ...audits.map((a) => ({ url: a.url, keyword: a.targetKeyword })),
  ];

  return suggestInternalLinks({
    targetKeyword: brief.targetKeyword,
    relatedKeywords: Array.isArray(brief.relatedKeywords)
      ? (brief.relatedKeywords as string[])
      : [],
    terms: Array.isArray(brief.terms)
      ? (brief.terms as unknown as SemanticTerm[]).map((t) => t.term)
      : [],
    candidates,
  });
}

/* ---------------------------------- meta ---------------------------------- */

async function writeMeta(
  brief: BriefRow,
  title: string,
): Promise<{
  metaTitle: string;
  metaDescription: string;
  slug: string;
  usedLlm: boolean;
}> {
  const fallback = {
    metaTitle: title.slice(0, 60),
    metaDescription: (brief.aiSummary ?? title).slice(0, 158),
    slug: slugify(title),
    usedLlm: false,
  };

  try {
    const result = await generateResearchJson<{
      metaTitle?: string;
      metaDescription?: string;
      slug?: string;
    }>(
      `Buat meta SEO (Bahasa Indonesia) untuk artikel "${title}" dengan keyword target "${brief.targetKeyword}".
Aturan: metaTitle ≤ 60 karakter dan memuat keyword di awal; metaDescription 120–160 karakter, persuasif tanpa clickbait; slug kebab-case pendek.
Balas HANYA JSON: { "metaTitle": "string", "metaDescription": "string", "slug": "string" }`,
      {
        tier: "flash",
        validate: (r) => typeof r.metaTitle === "string" && !!r.metaTitle,
      },
    );
    return {
      metaTitle: (result.metaTitle ?? fallback.metaTitle).trim().slice(0, 70),
      metaDescription: (result.metaDescription ?? fallback.metaDescription)
        .trim()
        .slice(0, 170),
      slug: slugify(result.slug?.trim() || title),
      usedLlm: true,
    };
  } catch (err) {
    console.warn("[seo/draft-writer] meta LLM gagal (fallback)", err);
    return fallback;
  }
}
