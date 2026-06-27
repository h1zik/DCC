import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  RankTrackerDetailClient,
  type TrackedKeywordRow,
} from "./rank-tracker-detail-client";

/** Batas waktu grafik tren (90 hari terakhir). */
function rankChartCutoff(): Date {
  return new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
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
            select: { position: true, capturedAt: true, serpFeatures: true },
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
    return {
      id: k.id,
      keyword: k.keyword,
      targetUrl: k.targetUrl,
      lastPosition: k.lastPosition,
      previousPosition: k.previousPosition,
      lastFoundUrl: k.lastFoundUrl,
      lastCheckedAt: k.lastCheckedAt?.toISOString() ?? null,
      features,
      points: k.snapshots.map((s) => ({
        t: s.capturedAt.toISOString(),
        position: s.position,
      })),
    };
  });

  return (
    <RankTrackerDetailClient
      project={{
        id: project.id,
        name: project.name,
        domain: project.domain,
        device: project.device,
        isActive: project.isActive,
      }}
      keywords={keywords}
    />
  );
}
