import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  shareOfVoice,
  visibilityScore,
  type ShareOfVoiceEntry,
} from "@/lib/seo/rank-tracker/visibility";
import { rankDistribution } from "@/lib/seo/rank-tracker/distribution";
import { detectCannibalization } from "@/lib/seo/rank-tracker/cannibalization";
import {
  RankTrackerDetailClient,
  type TrackedKeywordRow,
} from "./rank-tracker-detail-client";

/** Batas waktu grafik tren (90 hari terakhir). */
function rankChartCutoff(): Date {
  return new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
}

/** Batas time-series visibility (30 hari terakhir). */
function visibilityCutoff(): Date {
  return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default async function SeoRankTrackerDetailPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  const project = await prisma.seoRankProject.findUnique({
    where: { id: projectId },
    include: {
      keywords: {
        orderBy: { createdAt: "asc" },
        include: {
          snapshots: {
            where: { capturedAt: { gte: rankChartCutoff() } },
            orderBy: { capturedAt: "asc" },
            select: {
              position: true,
              capturedAt: true,
              serpFeatures: true,
              competitorPositions: true,
              foundUrl: true,
              ownMatches: true,
            },
          },
        },
      },
    },
  });
  if (!project) notFound();

  const keywords: TrackedKeywordRow[] = project.keywords.map((k) => {
    const latest = k.snapshots[k.snapshots.length - 1];
    const features = Array.isArray(latest?.serpFeatures)
      ? (latest!.serpFeatures as string[])
      : [];
    const competitorPositions =
      latest?.competitorPositions &&
      typeof latest.competitorPositions === "object" &&
      !Array.isArray(latest.competitorPositions)
        ? (latest.competitorPositions as Record<string, number | null>)
        : {};
    return {
      id: k.id,
      keyword: k.keyword,
      targetUrl: k.targetUrl,
      searchVolume: k.searchVolume,
      lastPosition: k.lastPosition,
      previousPosition: k.previousPosition,
      lastFoundUrl: k.lastFoundUrl,
      lastCheckedAt: k.lastCheckedAt?.toISOString() ?? null,
      features,
      competitorPositions,
      points: k.snapshots.map((s) => ({
        t: s.capturedAt.toISOString(),
        position: s.position,
      })),
    };
  });

  /* ------------------------- Visibility (sekarang + 30 hari) ------------------------ */
  const visibilityNow = visibilityScore(
    project.keywords.map((k) => ({
      position: k.lastPosition,
      searchVolume: k.searchVolume,
    })),
  );

  // Time-series harian: posisi terakhir per keyword per hari.
  const cutoff30 = visibilityCutoff();
  const byDay = new Map<string, Map<string, number | null>>();
  for (const k of project.keywords) {
    for (const s of k.snapshots) {
      if (s.capturedAt < cutoff30) continue;
      const day = dayKey(s.capturedAt);
      const dayMap = byDay.get(day) ?? new Map<string, number | null>();
      dayMap.set(k.id, s.position);
      byDay.set(day, dayMap);
    }
  }
  const volumeByKeyword = new Map(
    project.keywords.map((k) => [k.id, k.searchVolume]),
  );
  const visibilitySeries = [...byDay.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([day, positions]) => ({
      date: day,
      score: visibilityScore(
        [...positions.entries()].map(([kwId, pos]) => ({
          position: pos,
          searchVolume: volumeByKeyword.get(kwId) ?? null,
        })),
      ),
    }));

  /* ------------------------------- Share of voice ------------------------------- */
  let sov: ShareOfVoiceEntry[] = [];
  if (project.competitors.length > 0) {
    const rows = project.keywords
      .map((k) => {
        const latest = k.snapshots[k.snapshots.length - 1];
        const comp =
          latest?.competitorPositions &&
          typeof latest.competitorPositions === "object" &&
          !Array.isArray(latest.competitorPositions)
            ? (latest.competitorPositions as Record<string, number | null>)
            : null;
        if (!comp) return null;
        return {
          volume: k.searchVolume,
          positions: { [project.domain]: k.lastPosition, ...comp },
        };
      })
      .filter((r): r is NonNullable<typeof r> => r != null);
    if (rows.length > 0) sov = shareOfVoice(rows);
  }

  const distribution = rankDistribution(
    project.keywords.map((k) => k.lastPosition),
  );

  // Deteksi cannibalization (flip-flop URL + multi-URL top-20).
  const cannibalization = detectCannibalization(
    project.keywords.map((k) => ({
      keyword: k.keyword,
      snapshots: k.snapshots.map((s) => ({
        foundUrl: s.foundUrl,
        ownMatches: Array.isArray(s.ownMatches)
          ? (s.ownMatches as { position: number; url: string | null }[])
          : null,
      })),
    })),
  );

  return (
    <RankTrackerDetailClient
      project={{
        id: project.id,
        name: project.name,
        domain: project.domain,
        device: project.device,
        isActive: project.isActive,
        competitors: project.competitors,
      }}
      keywords={keywords}
      insights={{
        visibilityNow,
        visibilitySeries,
        shareOfVoice: sov,
        distribution,
        cannibalization,
      }}
    />
  );
}
