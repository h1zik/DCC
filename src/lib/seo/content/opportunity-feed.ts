import "server-only";

import {
  Prisma,
  SeoAnalysisStatus,
  SeoKeywordIntent,
  SeoOpportunityStage,
  SeoOpportunityType,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  classifyTrackedKeyword,
  deriveStage,
  excludeTopRanking,
  isTopRanking,
  mergeCandidates,
  normalizeOpportunityKeyword,
  scoreCandidate,
  selectPruneIds,
  type OpportunityCandidate,
} from "@/lib/seo/content/opportunity-feed-rules";
import { generateResearchJson } from "@/lib/research/llm";

/**
 * Engine feed Content Opportunities. Nol biaya API data (baca DB saja);
 * satu call LLM flash opsional untuk usulan judul kandidat teratas.
 */

/** Batas feed agar tetap fokus ke peluang terbaik. */
const FEED_CAP = 100;
/** Jumlah IDEA teratas yang diberi usulan judul LLM per refresh. */
const TITLE_SUGGESTION_COUNT = 15;

type MonthlyTrend = { direction?: "up" | "down" | "flat" } | null;

function trendOf(raw: Prisma.JsonValue | null): MonthlyTrend {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const dir = (raw as { direction?: unknown }).direction;
    if (dir === "up" || dir === "down" || dir === "flat") {
      return { direction: dir };
    }
  }
  return null;
}

export async function refreshOpportunities(): Promise<{
  total: number;
  pruned: number;
}> {
  /* ------------------------- Sumber A: keyword projects ------------------------ */
  const keywords = await prisma.seoKeyword.findMany({
    where: { project: { status: SeoAnalysisStatus.READY } },
    select: {
      keyword: true,
      searchVolume: true,
      difficulty: true,
      intent: true,
      clusterLabel: true,
      monthlyTrend: true,
      projectId: true,
    },
    take: 3000,
  });

  const projectKeywordSet = new Set(
    keywords.map((k) => normalizeOpportunityKeyword(k.keyword)),
  );
  const keywordDataByKey = new Map(
    keywords.map((k) => [normalizeOpportunityKeyword(k.keyword), k]),
  );

  const fromProjectsRaw: OpportunityCandidate[] = keywords.map((k) => ({
    keyword: normalizeOpportunityKeyword(k.keyword),
    type: SeoOpportunityType.NEW_ARTICLE,
    searchVolume: k.searchVolume,
    difficulty: k.difficulty,
    intent: k.intent,
    opportunityScore: scoreCandidate(
      {
        searchVolume: k.searchVolume,
        difficulty: k.difficulty,
        intent: k.intent,
        monthlyTrend: trendOf(k.monthlyTrend),
      },
      SeoOpportunityType.NEW_ARTICLE,
    ),
    currentPosition: null,
    targetUrl: null,
    source: "keyword_project",
    sourceRefId: k.projectId,
  }));

  /* -------------------------- Sumber B: rank tracker --------------------------- */
  const tracked = await prisma.seoTrackedKeyword.findMany({
    where: { project: { isActive: true } },
    select: {
      id: true,
      keyword: true,
      lastPosition: true,
      lastFoundUrl: true,
    },
    take: 2000,
  });

  // Keyword yang sudah di top 4 → tidak boleh direkomendasikan artikel baru.
  const topRankingKeywords = new Set(
    tracked
      .filter((t) => isTopRanking(t.lastPosition))
      .map((t) => normalizeOpportunityKeyword(t.keyword)),
  );
  const fromProjects = excludeTopRanking(fromProjectsRaw, topRankingKeywords);

  const fromTracker: OpportunityCandidate[] = [];
  for (const t of tracked) {
    const key = normalizeOpportunityKeyword(t.keyword);
    const type = classifyTrackedKeyword({
      keyword: t.keyword,
      lastPosition: t.lastPosition,
      lastFoundUrl: t.lastFoundUrl,
      inKeywordProject: projectKeywordSet.has(key),
    });
    if (!type) continue;
    const data = keywordDataByKey.get(key);
    fromTracker.push({
      keyword: key,
      type,
      searchVolume: data?.searchVolume ?? null,
      difficulty: data?.difficulty ?? null,
      intent: data?.intent ?? SeoKeywordIntent.UNKNOWN,
      opportunityScore: scoreCandidate(
        {
          searchVolume: data?.searchVolume ?? null,
          difficulty: data?.difficulty ?? null,
          intent: data?.intent ?? SeoKeywordIntent.UNKNOWN,
          monthlyTrend: trendOf(data?.monthlyTrend ?? null),
        },
        type,
        t.lastPosition,
      ),
      currentPosition: t.lastPosition,
      targetUrl: t.lastFoundUrl,
      source: "rank_tracker",
      sourceRefId: t.id,
    });
  }

  /* ------------------------------- Merge + cap -------------------------------- */
  const merged = mergeCandidates([...fromTracker, ...fromProjects]).slice(
    0,
    FEED_CAP,
  );
  const clusterByKey = new Map(
    keywords
      .filter((k) => k.clusterLabel)
      .map((k) => [normalizeOpportunityKeyword(k.keyword), k.clusterLabel]),
  );

  /* --------------------------------- Upsert ----------------------------------- */
  const now = new Date();
  for (const cand of merged) {
    const clusterLabel = clusterByKey.get(cand.keyword) ?? null;
    await prisma.seoContentOpportunity.upsert({
      where: { keyword: cand.keyword },
      create: {
        keyword: cand.keyword,
        type: cand.type,
        searchVolume: cand.searchVolume,
        difficulty: cand.difficulty,
        intent: cand.intent,
        opportunityScore: cand.opportunityScore,
        clusterLabel,
        currentPosition: cand.currentPosition,
        targetUrl: cand.targetUrl,
        source: cand.source,
        sourceRefId: cand.sourceRefId,
        lastRefreshedAt: now,
      },
      update: {
        type: cand.type,
        searchVolume: cand.searchVolume,
        difficulty: cand.difficulty,
        intent: cand.intent,
        opportunityScore: cand.opportunityScore,
        clusterLabel,
        currentPosition: cand.currentPosition,
        targetUrl: cand.targetUrl,
        source: cand.source,
        sourceRefId: cand.sourceRefId,
        lastRefreshedAt: now,
      },
    });
  }

  /* ----------------------------- Stage sync + prune ---------------------------- */
  await syncOpportunityStages();

  // Hanya baris buatan engine yang dipangkas — simpanan manual (topic_run,
  // gsc_decay) dibiarkan walau tidak muncul di hasil refresh.
  const keepKeywords = new Set(merged.map((c) => c.keyword));
  const pruneTargets = await prisma.seoContentOpportunity.findMany({
    where: { stage: SeoOpportunityStage.IDEA, briefId: null },
    select: { id: true, keyword: true, source: true },
  });
  const toDelete = selectPruneIds(pruneTargets, keepKeywords);
  if (toDelete.length > 0) {
    await prisma.seoContentOpportunity.deleteMany({
      where: { id: { in: toDelete } },
    });
  }

  /* ----------------------------- Usulan judul (LLM) ---------------------------- */
  await proposeTitlesForTopIdeas();

  return { total: merged.length, pruned: toDelete.length };
}

/** Sinkronkan stage dari relasi brief/draft/published (tidak pernah turun). */
export async function syncOpportunityStages(): Promise<void> {
  const rows = await prisma.seoContentOpportunity.findMany({
    where: { briefId: { not: null } },
    select: {
      id: true,
      stage: true,
      publishedUrl: true,
      brief: { select: { id: true, drafts: { select: { id: true }, take: 1 } } },
    },
  });
  for (const row of rows) {
    const next = deriveStage({
      current: row.stage,
      hasBrief: !!row.brief,
      hasDraft: (row.brief?.drafts.length ?? 0) > 0,
      publishedUrl: row.publishedUrl,
    });
    if (next !== row.stage) {
      await prisma.seoContentOpportunity.update({
        where: { id: row.id },
        data: { stage: next },
      });
    }
  }
}

async function proposeTitlesForTopIdeas(): Promise<void> {
  const ideas = await prisma.seoContentOpportunity.findMany({
    where: { stage: SeoOpportunityStage.IDEA, suggestedTitle: null },
    orderBy: { opportunityScore: "desc" },
    take: TITLE_SUGGESTION_COUNT,
  });
  if (ideas.length === 0) return;

  const list = ideas
    .map(
      (i) =>
        `- ${i.keyword} (vol ${i.searchVolume ?? "?"}, difficulty ${i.difficulty ?? "?"}, tipe ${i.type === "OPTIMIZE_EXISTING" ? `optimasi posisi #${i.currentPosition ?? "?"}` : "artikel baru"})`,
    )
    .join("\n");

  try {
    const result = await generateResearchJson<{
      items?: { keyword?: string; title?: string; angle?: string }[];
    }>(
      `Kamu content strategist SEO brand kosmetik/skincare Indonesia.
Untuk SETIAP keyword berikut, usulkan satu judul artikel SEO (memuat keyword natural, menarik, maks ~65 karakter) + "angle" 1 kalimat.

Keyword:
${list}

Balas HANYA JSON: { "items": [{ "keyword": "string", "title": "string", "angle": "string" }] }`,
      { tier: "flash", validate: (r) => Array.isArray(r.items) },
    );
    const byKey = new Map(
      (result.items ?? [])
        .filter((i) => i?.keyword && i?.title)
        .map((i) => [
          String(i.keyword).trim().toLowerCase(),
          { title: String(i.title).trim(), angle: i.angle?.trim() || null },
        ]),
    );
    for (const idea of ideas) {
      const hit = byKey.get(idea.keyword.toLowerCase());
      if (!hit) continue;
      await prisma.seoContentOpportunity.update({
        where: { id: idea.id },
        data: { suggestedTitle: hit.title, angle: hit.angle },
      });
    }
  } catch (err) {
    console.warn("[seo/opportunity-feed] usulan judul gagal (dilewati)", err);
  }
}
