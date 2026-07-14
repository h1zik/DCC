import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { LabPageShell } from "@/components/lab/lab-primitives";
import { parseTrendSourceConfigJson } from "@/lib/research/trend-radar/trend-source-config";
import { summarizeEnabledSources } from "@/lib/research/trend-radar/trend-source-config-types";
import {
  TrendDetailClient,
  type TrendDetailData,
} from "./trend-detail-client";
import type { TrendEvidenceRow } from "@/lib/research/trend-radar/trend-signal-types";
import type { TrendSignalStats } from "@/lib/research/trend-radar/trend-signal-types";
import { parseResearchAiMetaClient } from "@/lib/research/research-module-models";

type Props = {
  params: Promise<{ digestId: string }>;
  searchParams: Promise<{ item?: string }>;
};

function parseSources(raw: unknown) {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (x): x is { type: string; snippet: string; url?: string } =>
      typeof x === "object" && x != null && "type" in x && "snippet" in x,
  );
}

function parseEvidence(raw: unknown): TrendEvidenceRow[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (x): x is TrendEvidenceRow =>
      typeof x === "object" &&
      x != null &&
      typeof (x as TrendEvidenceRow).signalId === "string" &&
      typeof (x as TrendEvidenceRow).source === "string",
  );
}

function parseSignalStats(raw: unknown): TrendSignalStats | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as TrendSignalStats;
  if (typeof s.total !== "number") return null;
  return s;
}

export default async function TrendDetailPage({ params, searchParams }: Props) {
  const { digestId } = await params;
  const { item: highlightItemId } = await searchParams;

  const [digest, rooms] = await Promise.all([
    prisma.trendRadarDigest.findUnique({
      where: { id: digestId },
      include: {
        items: { orderBy: [{ phase: "asc" }, { tmiScore: "desc" }] },
        watchlist: { select: { name: true } },
      },
    }),
    prisma.room.findMany({
      where: { brandId: { not: null } },
      select: {
        id: true,
        name: true,
        brandId: true,
        brand: { select: { name: true } },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!digest) notFound();

  const sourceConfig = parseTrendSourceConfigJson(digest.sourceConfig);
  const sourceLabels = sourceConfig
    ? summarizeEnabledSources(sourceConfig)
    : [];

  const data: TrendDetailData = {
    id: digest.id,
    weekStart: digest.weekStart.toISOString(),
    weekEnd: digest.weekEnd.toISOString(),
    status: digest.status,
    digestMode: digest.digestMode,
    dataNotice: digest.dataNotice,
    signalStats: parseSignalStats(digest.signalStats),
    priorDigestId: digest.priorDigestId,
    narrative: digest.narrative,
    isGlobal: digest.isGlobal,
    watchlistName: digest.watchlist?.name ?? null,
    generatedAt: digest.generatedAt?.toISOString() ?? null,
    highlightItemId: highlightItemId ?? null,
    actionPlan: digest.aiActionPlan ?? null,
    aiMeta: parseResearchAiMetaClient(digest.aiMeta),
    sourceLabels,
    items: digest.items.map((i) => ({
      id: i.id,
      name: i.name,
      dimension: i.dimension,
      phase: i.phase,
      score: i.tmiScore ?? i.score,
      tmiScore: i.tmiScore ?? i.score,
      confidence: i.confidence,
      wowStatus: i.wowStatus,
      narrative: i.narrative,
      isGlobalPipeline: i.isGlobalPipeline,
      evidence: parseEvidence(i.evidence),
      sources: parseSources(i.sources),
      relatedProducts: Array.isArray(i.relatedProducts)
        ? (i.relatedProducts as string[])
        : [],
    })),
    rooms: rooms.map((r) => ({
      id: r.id,
      name: r.name,
      brandId: r.brandId,
      brandName: r.brand?.name ?? null,
    })),
  };

  return (
    <LabPageShell>
      <TrendDetailClient data={data} />
    </LabPageShell>
  );
}
