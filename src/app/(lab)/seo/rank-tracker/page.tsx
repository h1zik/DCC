import { LineChart } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { SeoModulePage } from "@/components/seo/seo-module-page";
import { visibilityScore } from "@/lib/seo/rank-tracker/visibility";
import { displayRankChangeKind } from "@/lib/seo/rank-tracker/rank-change";
import { buildAvgPositionSeries } from "@/lib/seo/rank-tracker/visibility-series";
import {
  RankTrackerClient,
  type RankProjectRow,
  type RankPortfolioSummary,
} from "./rank-tracker-client";

/** Rentang sparkline kartu proyek (hari kalender WIB). */
const SPARK_DAYS = 30;

/**
 * Batas ambil snapshot sparkline: rentang + 14 hari ke belakang agar posisi
 * keyword yang tidak dicek tepat di awal rentang tetap bisa di-carry-forward.
 */
function sparkCutoff(): Date {
  return new Date(Date.now() - (SPARK_DAYS + 14) * 24 * 60 * 60 * 1000);
}

export default async function SeoRankTrackerPage() {
  const [projects, snapshots] = await Promise.all([
    prisma.seoRankProject.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        keywords: {
          select: {
            keyword: true,
            lastPosition: true,
            previousPosition: true,
            searchVolume: true,
            _count: { select: { snapshots: true } },
          },
        },
      },
    }),
    prisma.seoRankSnapshot.findMany({
      where: { capturedAt: { gte: sparkCutoff() } },
      orderBy: { capturedAt: "asc" },
      select: {
        trackedKeywordId: true,
        position: true,
        capturedAt: true,
        trackedKeyword: { select: { projectId: true } },
      },
    }),
  ]);

  // Snapshot per keyword per proyek → posisi rata-rata harian (WIB) dengan
  // carry-forward per keyword untuk sparkline kartu.
  const snapsByProject = new Map<
    string,
    Map<string, { capturedAt: Date; position: number | null }[]>
  >();
  for (const s of snapshots) {
    const pid = s.trackedKeyword.projectId;
    const byKeyword =
      snapsByProject.get(pid) ??
      new Map<string, { capturedAt: Date; position: number | null }[]>();
    const list = byKeyword.get(s.trackedKeywordId) ?? [];
    list.push({ capturedAt: s.capturedAt, position: s.position });
    byKeyword.set(s.trackedKeywordId, list);
    snapsByProject.set(pid, byKeyword);
  }

  const rows: RankProjectRow[] = projects.map((p) => {
    const ranked = p.keywords
      .map((k) => k.lastPosition)
      .filter((x): x is number => x != null);
    const avgPosition = ranked.length
      ? Math.round((ranked.reduce((a, b) => a + b, 0) / ranked.length) * 10) / 10
      : null;

    let moversUp = 0;
    let moversDown = 0;
    for (const k of p.keywords) {
      const kind = displayRankChangeKind({
        previousPosition: k.previousPosition,
        lastPosition: k.lastPosition,
        snapshotCount: k._count.snapshots,
      });
      if (kind === "up" || kind === "entered") moversUp += 1;
      else if (kind === "down" || kind === "dropped") moversDown += 1;
    }

    const best =
      p.keywords
        .filter((k) => k.lastPosition != null)
        .sort((a, b) => a.lastPosition! - b.lastPosition!)[0] ?? null;

    const spark = buildAvgPositionSeries(
      [...(snapsByProject.get(p.id)?.entries() ?? [])].map(([id, snaps]) => ({
        id,
        searchVolume: null,
        snapshots: snaps,
      })),
      SPARK_DAYS,
    ).map((pt) => pt.avgPosition);

    return {
      id: p.id,
      name: p.name,
      domain: p.domain,
      device: p.device,
      isActive: p.isActive,
      keywordCount: p.keywords.length,
      createdAt: p.createdAt.toISOString(),
      visibility: visibilityScore(
        p.keywords.map((k) => ({
          position: k.lastPosition,
          searchVolume: k.searchVolume,
        })),
      ),
      avgPosition,
      top3: ranked.filter((x) => x <= 3).length,
      page1: ranked.filter((x) => x <= 10).length,
      moversUp,
      moversDown,
      bestKeyword: best
        ? { keyword: best.keyword, position: best.lastPosition! }
        : null,
      spark,
    };
  });

  const allKeywords = projects.flatMap((p) => p.keywords);
  const allRanked = allKeywords
    .map((k) => k.lastPosition)
    .filter((x): x is number => x != null);
  const summary: RankPortfolioSummary = {
    totalProjects: rows.length,
    activeProjects: rows.filter((r) => r.isActive).length,
    totalKeywords: allKeywords.length,
    avgPosition: allRanked.length
      ? Math.round(
          (allRanked.reduce((a, b) => a + b, 0) / allRanked.length) * 10,
        ) / 10
      : null,
    top3: allRanked.filter((x) => x <= 3).length,
    page1: allRanked.filter((x) => x <= 10).length,
    moversUp: rows.reduce((a, r) => a + r.moversUp, 0),
    moversDown: rows.reduce((a, r) => a + r.moversDown, 0),
  };

  return (
    <SeoModulePage
      icon={LineChart}
      title="SERP Rank Tracker"
      description="Pantau posisi keyword di Google Indonesia secara terjadwal (cron harian). Lihat tren posisi & SERP feature, dan dapat web push saat ada perubahan signifikan."
    >
      <RankTrackerClient projects={rows} summary={summary} />
    </SeoModulePage>
  );
}
