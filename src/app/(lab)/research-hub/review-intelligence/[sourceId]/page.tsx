import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { resumeStuckResearchJobs } from "@/lib/research/run-apify-job";
import { LabPageShell } from "@/components/lab/lab-primitives";
import {
  ReviewDetailClient,
  type ReviewDetailData,
} from "./review-detail-client";
import { parseResearchAiMetaClient } from "@/lib/research/research-module-models";
import { reviewScrapeProvenance } from "@/lib/research/resolve-scrape-provenance";

type Props = { params: Promise<{ sourceId: string }> };

function parseThemes(raw: unknown): { theme: string; count: number }[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (x): x is { theme: string; count: number } =>
        typeof x === "object" &&
        x != null &&
        "theme" in x &&
        "count" in x,
    )
    .map((x) => ({ theme: String(x.theme), count: Number(x.count) }));
}

function parseKeywords(raw: unknown): { word: string; count: number }[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (x): x is { word: string; count: number } =>
        typeof x === "object" &&
        x != null &&
        "word" in x &&
        "count" in x,
    )
    .map((x) => ({ word: String(x.word), count: Number(x.count) }));
}

function parseSeverity(
  raw: unknown,
): { theme: string; avgSeverity: number; count: number }[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (x): x is { theme: string; avgSeverity: number; count: number } =>
        typeof x === "object" && x != null && "theme" in x,
    )
    .map((x) => ({
      theme: String(x.theme),
      avgSeverity: Number(x.avgSeverity ?? 0),
      count: Number(x.count ?? 0),
    }));
}

function parseDemographics(raw: unknown): {
  skinTypes: { value: string; count: number }[];
  ageBands: { value: string; count: number }[];
  genders: { value: string; count: number }[];
} {
  const empty = { skinTypes: [], ageBands: [], genders: [] };
  if (!raw || typeof raw !== "object") return empty;
  const obj = raw as Record<string, unknown>;
  const pick = (key: string): { value: string; count: number }[] => {
    const arr = obj[key];
    if (!Array.isArray(arr)) return [];
    return arr
      .filter(
        (x): x is { value: string; count: number } =>
          typeof x === "object" && x != null && "value" in x,
      )
      .map((x) => ({ value: String(x.value), count: Number(x.count ?? 0) }));
  };
  return {
    skinTypes: pick("skinTypes"),
    ageBands: pick("ageBands"),
    genders: pick("genders"),
  };
}

function parseTimeline(
  raw: unknown,
): { month: string; positive: number; neutral: number; negative: number }[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (x): x is {
        month: string;
        positive: number;
        neutral: number;
        negative: number;
      } =>
        typeof x === "object" &&
        x != null &&
        "month" in x,
    )
    .map((x) => ({
      month: String(x.month),
      positive: Number(x.positive ?? 0),
      neutral: Number(x.neutral ?? 0),
      negative: Number(x.negative ?? 0),
    }));
}

export default async function ReviewDetailPage({ params }: Props) {
  const { sourceId } = await params;

  await resumeStuckResearchJobs();

  const [source, compareSources, rooms] = await Promise.all([
    prisma.reviewIntelSource.findUnique({
      where: { id: sourceId },
      include: { summary: true },
    }),
    prisma.reviewIntelSource.findMany({
      where: { status: "READY", id: { not: sourceId } },
      include: { summary: true },
      take: 10,
      orderBy: { updatedAt: "desc" },
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

  if (!source) notFound();

  const dataProvenance = await reviewScrapeProvenance({
    sourceId: source.id,
    platformKey: source.platformKey,
    productName: source.productName,
  });

  const detail: ReviewDetailData = {
    id: source.id,
    productName: source.productName,
    competitorBrand: source.competitorBrand,
    platformKey: source.platformKey,
    productUrl: source.productUrl,
    marketplace: source.marketplace,
    status: source.status,
    reviewCount: source.reviewCount,
    totalReviewsReported: source.totalReviewsReported,
    reviewsComplete: source.reviewsComplete,
    lastAnalyzedAt: source.lastAnalyzedAt?.toISOString() ?? null,
    aiMeta: parseResearchAiMetaClient(source.summary?.aiMeta),
    dataProvenance,
    summary: source.summary
      ? {
          positivePct: source.summary.positivePct,
          neutralPct: source.summary.neutralPct,
          negativePct: source.summary.negativePct,
          topComplaints: parseThemes(source.summary.topComplaints),
          topPraises: parseThemes(source.summary.topPraises),
          keywordCloud: parseKeywords(source.summary.keywordCloud),
          timelineBuckets: parseTimeline(source.summary.timelineBuckets),
          gapOpportunity: source.summary.gapOpportunity,
          severityByTheme: parseSeverity(source.summary.severityByTheme),
          demographics: parseDemographics(source.summary.demographics),
          actionPlan: source.summary.aiActionPlan ?? null,
        }
      : null,
  };

  const compareOptions = compareSources
    .filter((s) => s.summary)
    .map((s) => ({
      id: s.id,
      productName: s.productName,
      competitorBrand: s.competitorBrand,
      positivePct: s.summary!.positivePct,
      neutralPct: s.summary!.neutralPct,
      negativePct: s.summary!.negativePct,
    }));

  return (
    <LabPageShell>
      <ReviewDetailClient
        source={detail}
        compareOptions={compareOptions}
        rooms={rooms.map((r) => ({
          id: r.id,
          name: r.name,
          brandId: r.brandId,
          brandName: r.brand?.name ?? null,
        }))}
      />
    </LabPageShell>
  );
}
