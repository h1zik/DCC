import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  KeywordDetailClient,
  type KeywordDetailData,
} from "./keyword-detail-client";

type Props = { params: Promise<{ queryId: string }> };

function parseMatrix(raw: unknown) {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (x): x is KeywordDetailData["matrix"][number] =>
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

  const copyRaw = query.result?.copyKeywords;
  const copyMeta =
    copyRaw &&
    typeof copyRaw === "object" &&
    !Array.isArray(copyRaw) &&
    "_meta" in copyRaw &&
    copyRaw._meta &&
    typeof copyRaw._meta === "object"
      ? (copyRaw._meta as {
          isDemo?: boolean;
          dataNotice?: string | null;
          volumeSource?: string;
        })
      : null;

  const copyKeywords =
    copyRaw && typeof copyRaw === "object" && !Array.isArray(copyRaw)
      ? (copyRaw as KeywordDetailData["copyKeywords"])
      : {};

  const data: KeywordDetailData = {
    id: query.id,
    category: query.category,
    seedKeyword: query.seedKeyword,
    marketplace: query.marketplace,
    status: query.status,
    errorMessage: query.errorMessage,
    aiSummary: query.result?.aiSummary ?? null,
    dataNotice: copyMeta?.dataNotice ?? null,
    isDemo: copyMeta?.isDemo === true,
    hasGoogleVolume: copyMeta?.volumeSource === "dataforseo",
    matrix: parseMatrix(query.result?.keywordMatrix),
    gaps: parseGaps(query.result?.gapKeywords),
    namingSuggestions: Array.isArray(query.result?.namingSuggestions)
      ? (query.result.namingSuggestions as string[])
      : [],
    copyKeywords,
    seasonalCalendar: Array.isArray(query.result?.seasonalCalendar)
      ? (query.result.seasonalCalendar as KeywordDetailData["seasonalCalendar"])
      : [],
    clusters: Array.isArray(query.result?.clusters)
      ? (query.result.clusters as KeywordDetailData["clusters"])
      : [],
    rooms: rooms.map((r) => ({
      id: r.id,
      name: r.name,
      brandId: r.brandId,
      brandName: r.brand?.name ?? null,
    })),
  };

  return <KeywordDetailClient data={data} />;
}
