import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  shareOfVoice,
  visibilityBreakdown,
  type ShareOfVoiceEntry,
} from "@/lib/seo/rank-tracker/visibility";
import { buildVisibilitySeries } from "@/lib/seo/rank-tracker/visibility-series";
import { rankDistribution } from "@/lib/seo/rank-tracker/distribution";
import { detectCannibalization } from "@/lib/seo/rank-tracker/cannibalization";
import { getLatestRankSyncJob } from "@/lib/seo/rank-tracker/rank-sync";
import {
  RankTrackerDetailClient,
  type RankSyncStatus,
  type TrackedKeywordRow,
} from "./rank-tracker-detail-client";

/** Batas waktu grafik tren (90 hari terakhir). */
function rankChartCutoff(): Date {
  return new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
}

/** Rentang time-series visibility (hari kalender WIB). */
const VISIBILITY_DAYS = 30;

export default async function SeoRankTrackerDetailPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  const [project, lastJob] = await Promise.all([
    prisma.seoRankProject.findUnique({
      where: { id: projectId },
      include: {
        keywords: {
          orderBy: { createdAt: "asc" },
          include: {
            _count: { select: { snapshots: true } },
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
    }),
    getLatestRankSyncJob(projectId),
  ]);
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
      snapshotCount: k._count.snapshots,
      features,
      competitorPositions,
      points: k.snapshots.map((s) => ({
        t: s.capturedAt.toISOString(),
        position: s.position,
      })),
    };
  });

  /* ------------------------- Visibility (sekarang + 30 hari) ------------------------ */
  const { score: visibilityNow, unknownVolumeCount } = visibilityBreakdown(
    project.keywords.map((k) => ({
      position: k.lastPosition,
      searchVolume: k.searchVolume,
    })),
  );

  // Time-series harian (WIB) dengan carry-forward per keyword: snapshot 90 hari
  // yang sudah dimuat jadi sumber carry-forward untuk rentang 30 hari.
  const visibilitySeries = buildVisibilitySeries(
    project.keywords.map((k) => ({
      id: k.id,
      searchVolume: k.searchVolume,
      snapshots: k.snapshots.map((s) => ({
        capturedAt: s.capturedAt,
        position: s.position,
      })),
    })),
    VISIBILITY_DAYS,
  );

  /* --------------------------- Visibility per domain --------------------------- */
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

  const lastSync: RankSyncStatus | null = lastJob
    ? {
        status: lastJob.status,
        percent: lastJob.percent,
        stepLabel: lastJob.stepLabel,
        error: lastJob.error,
        startedAt: lastJob.startedAt?.toISOString() ?? null,
        completedAt: lastJob.completedAt?.toISOString() ?? null,
        stale: lastJob.stale,
      }
    : null;

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
        unknownVolumeCount,
        visibilitySeries,
        shareOfVoice: sov,
        distribution,
        cannibalization,
      }}
      lastSync={lastSync}
    />
  );
}
