import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ResearchHubPageShell } from "@/components/research-hub/research-hub-primitives";
import {
  KeywordDetailClient,
  type KeywordDetailData,
} from "./keyword-detail-client";
import { parseResearchAiMetaClient } from "@/lib/research/research-module-models";
import type {
  KeywordMatrixRow,
  KeywordSignalStats,
  SeasonalCurve,
} from "@/lib/research/keyword-intel/keyword-signal-types";

type Props = { params: Promise<{ queryId: string }> };

function parseMatrix(raw: unknown): KeywordMatrixRow[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (x): x is KeywordMatrixRow =>
      typeof x === "object" &&
      x != null &&
      "keyword" in x &&
      typeof (x as { keyword: unknown }).keyword === "string",
  );
}

function parseGaps(raw: unknown) {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (x): x is KeywordDetailData["gaps"][number] =>
      typeof x === "object" && x != null && "keyword" in x,
  );
}

function parseSignalStats(raw: unknown): KeywordSignalStats | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as KeywordSignalStats;
  if (typeof s.total !== "number") return null;
  return s;
}

function parseSeasonalCurves(raw: unknown): SeasonalCurve[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (x): x is SeasonalCurve =>
      typeof x === "object" &&
      x != null &&
      typeof (x as SeasonalCurve).keyword === "string",
  );
}

export default async function KeywordDetailPage({ params }: Props) {
  const { queryId } = await params;

  const [query, rooms] = await Promise.all([
    prisma.keywordIntelQuery.findUnique({
      where: { id: queryId },
      include: { result: true },
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

  if (!query) notFound();

  const data: KeywordDetailData = {
    id: query.id,
    category: query.category,
    seedKeyword: query.seedKeyword,
    marketplace: query.marketplace,
    status: query.status,
    dataNotice: query.dataNotice,
    signalStats: parseSignalStats(query.signalStats),
    volumeSource: query.volumeSource,
    errorMessage: query.errorMessage,
    aiSummary: query.result?.aiSummary ?? null,
    hasGoogleVolume: query.volumeSource === "dataforseo",
    matrix: parseMatrix(query.result?.keywordMatrix),
    gaps: parseGaps(query.result?.gapKeywords),
    namingSuggestions: Array.isArray(query.result?.namingSuggestions)
      ? (query.result.namingSuggestions as string[])
      : [],
    copyKeywords:
      query.result?.copyKeywords &&
      typeof query.result.copyKeywords === "object" &&
      !Array.isArray(query.result.copyKeywords)
        ? (query.result.copyKeywords as KeywordDetailData["copyKeywords"])
        : {},
    seasonalCalendar: Array.isArray(query.result?.seasonalCalendar)
      ? (query.result.seasonalCalendar as KeywordDetailData["seasonalCalendar"])
      : [],
    seasonalCurves: parseSeasonalCurves(query.result?.seasonalCurves),
    clusters: Array.isArray(query.result?.clusters)
      ? (query.result.clusters as KeywordDetailData["clusters"])
      : [],
    actionPlan: query.result?.aiActionPlan ?? null,
    aiMeta: parseResearchAiMetaClient(query.result?.aiMeta),
    rooms: rooms.map((r) => ({
      id: r.id,
      name: r.name,
      brandId: r.brandId,
      brandName: r.brand?.name ?? null,
    })),
  };

  return (
    <ResearchHubPageShell>
      <KeywordDetailClient data={data} />
    </ResearchHubPageShell>
  );
}
