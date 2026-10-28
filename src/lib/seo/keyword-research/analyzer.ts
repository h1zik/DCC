import "server-only";

import { Prisma, SeoAnalysisStatus, SeoKeywordIntent } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { DataForSeoError, isDataForSeoConfigured } from "@/lib/seo/dataforseo/client";
import {
  collectKeywordIdeas,
  enrichKeywordIdeas,
  type KeywordMonthlyTrend,
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

/** Penanda `SeoKeyword.source` untuk keyword hasil impor dari Keyword Gap. */
export const KEYWORD_GAP_SOURCE = "keyword_gap";

/**
 * Jalankan riset keyword untuk satu proyek: kumpulkan ide keyword (volume,
 * difficulty, CPC, intent) dari DataForSEO Labs, cluster berdasarkan intent
 * (LLM dengan fallback deterministik), lalu persist ke `SeoKeyword`.
 *
 * Proyek hasil impor Keyword Gap (ada keyword ber-`source = "keyword_gap"`)
 * tidak diriset ulang dari seed — daftar keyword yang ada di-enrich (volume,
 * CPC, competition, difficulty, intent) lalu di-cluster, agar re-run tidak
 * menghapus daftar impor.
 */
export async function runKeywordResearch(projectId: string): Promise<void> {
  const project = await prisma.seoKeywordProject.findUnique({
    where: { id: projectId },
  });
  if (!project) throw new Error("Proyek keyword tidak ditemukan.");

  const importedCount = await prisma.seoKeyword.count({
    where: { projectId, source: KEYWORD_GAP_SOURCE },
  });
  if (importedCount > 0) {
    await runImportedKeywordEnrichment(projectId);
    return;
  }

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
      await prisma.$transaction([
        prisma.seoKeyword.deleteMany({ where: { projectId } }),
        prisma.seoKeywordProject.update({
          where: { id: projectId },
          data: {
            status: SeoAnalysisStatus.READY,
            dataNotice: "Tidak ada keyword ditemukan untuk seed ini.",
            aiSummary: null,
          },
        }),
      ]);
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

    await persistKeywordResults(projectId, ideas, clusters, summary, aiSteps);
  } catch (err) {
    await markResearchFailed(projectId, err);
    throw err;
  }
}

/**
 * Jalur proyek impor (Keyword Gap): enrich daftar keyword yang ada via bulk
 * endpoint + cluster, tanpa riset dari seed. Daftar keyword dipertahankan
 * (source tetap `keyword_gap`); penggantian baris dilakukan dalam transaksi.
 */
async function runImportedKeywordEnrichment(projectId: string): Promise<void> {
  const project = await prisma.seoKeywordProject.findUnique({
    where: { id: projectId },
    include: { keywords: { orderBy: [{ searchVolume: "desc" }, { keyword: "asc" }] } },
  });
  if (!project) throw new Error("Proyek keyword tidak ditemukan.");

  // Daftar impor tetap berguna tanpa DataForSEO — jangan tandai FAILED,
  // cukup beri tahu bahwa metrik tidak diperbarui.
  if (!isDataForSeoConfigured()) {
    await prisma.seoKeywordProject.update({
      where: { id: projectId },
      data: {
        status: SeoAnalysisStatus.READY,
        errorMessage: null,
        dataNotice:
          "Daftar keyword berasal dari impor Keyword Gap. DataForSEO belum dikonfigurasi sehingga volume/CPC/intent tidak diperbarui.",
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
    const ideas: SeoKeywordIdea[] = project.keywords.map((row) => ({
      keyword: row.keyword,
      searchVolume: row.searchVolume,
      cpc: row.cpc,
      competition: row.competition,
      difficulty: row.difficulty,
      intent: row.intent,
      monthlyTrend: parseStoredTrend(row.monthlyTrend),
      source: row.source ?? KEYWORD_GAP_SOURCE,
    }));

    if (ideas.length === 0) {
      await prisma.seoKeywordProject.update({
        where: { id: projectId },
        data: {
          status: SeoAnalysisStatus.READY,
          dataNotice: "Proyek impor ini tidak memiliki keyword.",
          aiSummary: null,
        },
      });
      return;
    }

    await enrichKeywordIdeas(ideas, {
      locationCode: project.locationCode,
      languageCode: project.languageCode,
    });

    await prisma.seoKeywordProject.update({
      where: { id: projectId },
      data: { status: SeoAnalysisStatus.ANALYZING },
    });

    const { clusters, summary, aiSteps } = await clusterKeywords(
      project.seedKeyword,
      ideas,
    );

    await persistKeywordResults(projectId, ideas, clusters, summary, aiSteps, {
      dataNotice: `Daftar keyword berasal dari impor Keyword Gap (${ideas.length} keyword); riset ulang hanya memperbarui metrik dan cluster, bukan menambah keyword dari seed.`,
    });
  } catch (err) {
    await markResearchFailed(projectId, err);
    throw err;
  }
}

/** Ganti baris keyword + tandai READY secara atomik. */
async function persistKeywordResults(
  projectId: string,
  ideas: SeoKeywordIdea[],
  clusters: KeywordCluster[],
  summary: string | null,
  aiSteps: ResearchAiModelStep[],
  extra: { dataNotice?: string | null } = {},
): Promise<void> {
  const assignment = clusterAssignmentMap(clusters);
  const aiMeta = aiSteps.length
    ? (researchAiMetaFromSteps(aiSteps) as object)
    : undefined;

  await prisma.$transaction([
    prisma.seoKeyword.deleteMany({ where: { projectId } }),
    prisma.seoKeyword.createMany({
      data: ideas.map((idea) =>
        buildKeywordRow(projectId, idea, assignment.get(idea.keyword.toLowerCase())),
      ),
      skipDuplicates: true,
    }),
    prisma.seoKeywordProject.update({
      where: { id: projectId },
      data: {
        status: SeoAnalysisStatus.READY,
        aiSummary: summary,
        aiMeta,
        errorMessage: null,
        ...(extra.dataNotice !== undefined ? { dataNotice: extra.dataNotice } : {}),
      },
    }),
  ]);
}

async function markResearchFailed(projectId: string, err: unknown): Promise<void> {
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
}

function parseStoredTrend(value: Prisma.JsonValue | null): KeywordMonthlyTrend | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const trend = value as { direction?: unknown; points?: unknown };
  if (
    trend.direction !== "up" &&
    trend.direction !== "down" &&
    trend.direction !== "flat"
  ) {
    return null;
  }
  return {
    direction: trend.direction,
    points: Array.isArray(trend.points)
      ? (trend.points as KeywordMonthlyTrend["points"])
      : [],
  };
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
