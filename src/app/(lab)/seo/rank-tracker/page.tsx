import { LineChart } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { SeoModulePage } from "@/components/seo/seo-module-page";
import { visibilityScore } from "@/lib/seo/rank-tracker/visibility";
import { rankChangeKind } from "@/lib/seo/rank-tracker/rank-change";
import {
  RankTrackerClient,
  type RankProjectRow,
  type RankPortfolioSummary,
} from "./rank-tracker-client";

/** Batas waktu sparkline kartu proyek (30 hari terakhir). */
function sparkCutoff(): Date {
  return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
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
          },
        },
      },
    }),
    prisma.seoRankSnapshot.findMany({
      where: { capturedAt: { gte: sparkCutoff() }, position: { not: null } },
      orderBy: { capturedAt: "asc" },
      select: {
        position: true,
        capturedAt: true,
        trackedKeyword: { select: { projectId: true } },
      },
    }),
  ]);

  // Rata-rata posisi per hari per proyek → data sparkline kartu.
  const sparkByProject = new Map<
    string,
    Map<string, { total: number; count: number }>
  >();
  for (const s of snapshots) {
    if (s.position == null) continue;
    const pid = s.trackedKeyword.projectId;
    const day = s.capturedAt.toISOString().slice(0, 10);
    const days =
      sparkByProject.get(pid) ?? new Map<string, { total: number; count: number }>();
    const cur = days.get(day) ?? { total: 0, count: 0 };
    cur.total += s.position;
    cur.count += 1;
    days.set(day, cur);
    sparkByProject.set(pid, days);
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
      const kind = rankChangeKind(k.previousPosition, k.lastPosition);
      if (kind === "up" || kind === "entered") moversUp += 1;
      else if (kind === "down" || kind === "dropped") moversDown += 1;
    }

    const best =
      p.keywords
        .filter((k) => k.lastPosition != null)
        .sort((a, b) => a.lastPosition! - b.lastPosition!)[0] ?? null;

    const spark = [...(sparkByProject.get(p.id)?.entries() ?? [])]
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([, v]) => Math.round((v.total / v.count) * 10) / 10);

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
