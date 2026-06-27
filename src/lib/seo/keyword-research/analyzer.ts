import "server-only";

import { Prisma, SeoAnalysisStatus, SeoKeywordIntent } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { DataForSeoError, isDataForSeoConfigured } from "@/lib/seo/dataforseo/client";
import {
  collectKeywordIdeas,
  type SeoKeywordIdea,
} from "@/lib/seo/dataforseo/keywords";
import {
  buildResearchAiStep,
  generateResearchJson,
  researchAiMetaFromSteps,
  type ResearchAiModelStep,
} from "@/lib/research/llm";
import {
  clusterAssignmentMap,
  clusterKeywordsByIntent,
  normalizeClusters,
  type KeywordCluster,
} from "@/lib/seo/keyword-research/clustering";

/** Maksimum keyword yang diriset per proyek (jaga ukuran prompt & biaya). */
const MAX_KEYWORDS = 100;

/**
 * Jalankan riset keyword untuk satu proyek: kumpulkan ide keyword (volume,
 * difficulty, CPC, intent) dari DataForSEO Labs, cluster berdasarkan intent
 * (LLM dengan fallback deterministik), lalu persist ke `SeoKeyword`.
 */
export async function runKeywordResearch(projectId: string): Promise<void> {
  const project = await prisma.seoKeywordProject.findUnique({
    where: { id: projectId },
  });
  if (!project) throw new Error("Proyek keyword tidak ditemukan.");

  if (!isDataForSeoConfigured()) {
    await prisma.seoKeywordProject.update({
      where: { id: projectId },
      data: {
        status: SeoAnalysisStatus.FAILED,
        errorMessage:
          "DataForSEO belum dikonfigurasi (set DATAFORSEO_LOGIN & DATAFORSEO_PASSWORD).",
      },
    });
    return;
  }

  await prisma.seoKeywordProject.update({
    where: { id: projectId },
    data: {
      status: SeoAnalysisStatus.COLLECTING,
      errorMessage: null,
      dataNotice: null,
    },
  });

  try {
    const ideas = await collectKeywordIdeas(project.seedKeyword, {
      locationCode: project.locationCode,
      languageCode: project.languageCode,
      limit: MAX_KEYWORDS,
    });

    if (ideas.length === 0) {
      await prisma.seoKeyword.deleteMany({ where: { projectId } });
      await prisma.seoKeywordProject.update({
        where: { id: projectId },
        data: {
          status: SeoAnalysisStatus.READY,
          dataNotice: "Tidak ada keyword ditemukan untuk seed ini.",
          aiSummary: null,
        },
      });
      return;
    }

    await prisma.seoKeywordProject.update({
      where: { id: projectId },
      data: { status: SeoAnalysisStatus.ANALYZING },
    });

    const { clusters, summary, aiSteps } = await clusterKeywords(
      project.seedKeyword,
      ideas,
    );
    const assignment = clusterAssignmentMap(clusters);

    // Replace keyword lama dengan hasil baru.
    await prisma.seoKeyword.deleteMany({ where: { projectId } });
    await prisma.seoKeyword.createMany({
      data: ideas.map((idea) =>
        buildKeywordRow(projectId, idea, assignment.get(idea.keyword.toLowerCase())),
      ),
      skipDuplicates: true,
    });

    const aiMeta = aiSteps.length
      ? (researchAiMetaFromSteps(aiSteps) as object)
      : undefined;

    await prisma.seoKeywordProject.update({
      where: { id: projectId },
      data: {
        status: SeoAnalysisStatus.READY,
        aiSummary: summary,
        aiMeta,
        errorMessage: null,
      },
    });
  } catch (err) {
    const message =
      err instanceof DataForSeoError
        ? err.balanceExhausted
          ? "Saldo DataForSEO habis — top up untuk melanjutkan riset."
          : err.message
        : err instanceof Error
          ? err.message
          : "Riset keyword gagal.";
    await prisma.seoKeywordProject.update({
      where: { id: projectId },
      data: { status: SeoAnalysisStatus.FAILED, errorMessage: message },
    });
    throw err;
  }
}

/** Alias enqueue (konsisten dengan modul research; saat ini sinkron via after()). */
export async function enqueueKeywordResearch(projectId: string): Promise<void> {
  await runKeywordResearch(projectId);
}

function buildKeywordRow(
  projectId: string,
  idea: SeoKeywordIdea,
  assigned: { label: string; intent: SeoKeywordIntent } | undefined,
): Prisma.SeoKeywordCreateManyInput {
  const intent =
    idea.intent !== SeoKeywordIntent.UNKNOWN
      ? idea.intent
      : (assigned?.intent ?? SeoKeywordIntent.UNKNOWN);

  return {
    projectId,
    keyword: idea.keyword,
    searchVolume: idea.searchVolume,
    cpc: idea.cpc,
    competition: idea.competition,
    difficulty: idea.difficulty,
    intent,
    clusterLabel: assigned?.label ?? null,
    monthlyTrend: idea.monthlyTrend
      ? (idea.monthlyTrend as unknown as Prisma.InputJsonValue)
      : Prisma.JsonNull,
    source: idea.source,
  };
}

type ClusterOutcome = {
  clusters: KeywordCluster[];
  summary: string | null;
  aiSteps: ResearchAiModelStep[];
};

/**
 * Cluster keyword via LLM (intent + label tematik) dengan fallback deterministik
 * berdasarkan intent bila LLM gagal/ tidak terkonfigurasi.
 */
async function clusterKeywords(
  seed: string,
  ideas: SeoKeywordIdea[],
): Promise<ClusterOutcome> {
  // Batasi ukuran prompt: ambil keyword dengan volume tertinggi.
  const top = [...ideas]
    .sort((a, b) => (b.searchVolume ?? 0) - (a.searchVolume ?? 0))
    .slice(0, 120);

  const list = top
    .map(
      (k) =>
        `- ${k.keyword} (vol: ${k.searchVolume ?? "?"}, intent: ${k.intent.toLowerCase()})`,
    )
    .join("\n");

  const prompt = `Kamu adalah SEO strategist untuk brand kosmetik/skincare di pasar Indonesia.
Seed keyword: "${seed}".

Kelompokkan keyword berikut menjadi beberapa cluster bertema (mis. per kebutuhan,
per bahan, per use-case), dan tetapkan intent dominan tiap cluster.

Keyword:
${list}

Aturan:
- intent salah satu dari: INFORMATIONAL, COMMERCIAL, TRANSACTIONAL, NAVIGATIONAL.
- Setiap keyword hanya boleh masuk ke satu cluster.
- Pakai HANYA keyword dari daftar di atas (jangan mengarang keyword baru).
- label cluster singkat dalam Bahasa Indonesia.
- summary: 2-3 kalimat strategi konten/SEO ringkas (Bahasa Indonesia).

Balas HANYA JSON valid:
{
  "clusters": [{ "label": "string", "intent": "COMMERCIAL", "keywords": ["string"] }],
  "summary": "string"
}`;

  try {
    const result = await generateResearchJson<{
      clusters?: unknown;
      summary?: string;
    }>(prompt, {
      tier: "pro",
      validate: (r) => Array.isArray(r.clusters) && r.clusters.length > 0,
    });
    const clusters = normalizeClusters(result.clusters, ideas);
    if (clusters.length === 0) throw new Error("Cluster kosong.");
    return {
      clusters,
      summary: result.summary?.trim() || null,
      aiSteps: [buildResearchAiStep("SEO keyword clustering", "pro")],
    };
  } catch (err) {
    console.warn(
      "[seo/keyword-research] clustering LLM gagal — fallback ke intent",
      err,
    );
    return {
      clusters: clusterKeywordsByIntent(ideas),
      summary: null,
      aiSteps: [],
    };
  }
}
