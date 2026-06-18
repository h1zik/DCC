import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { parseTrendSourceConfigJson } from "@/lib/research/trend-radar/trend-source-config";
import { summarizeEnabledSources } from "@/lib/research/trend-radar/trend-source-config-types";
import {
  BrandTrendDetailClient,
  type TrendDetailData,
} from "./brand-trend-detail-client";
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

export default async function TrendDetailPage({ params, searchParams }: Props) {
  const { digestId } = await params;
  const { item: highlightItemId } = await searchParams;

  const [digest, rooms] = await Promise.all([
    prisma.brandTrendDigest.findUnique({
      where: { id: digestId },
      include: {
        items: { orderBy: [{ phase: "asc" }, { score: "desc" }] },
        ownerBrand: { select: { name: true } },
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
    narrative: digest.narrative,
    isGlobal: digest.isGlobal,
    watchlistName: digest.ownerBrand?.name ?? null,
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
      score: i.score,
      narrative: i.narrative,
      isGlobalPipeline: i.isGlobalPipeline,
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

  return <BrandTrendDetailClient data={data} />;
}
