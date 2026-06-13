import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { resumeStuckResearchJobs } from "@/lib/research/run-apify-job";
import {
  ReviewDetailClient,
  type ReviewDetailData,
} from "./review-detail-client";

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

  const detail: ReviewDetailData = {
    id: source.id,
    productName: source.productName,
    competitorBrand: source.competitorBrand,
    marketplace: source.marketplace,
    status: source.status,
    reviewCount: source.reviewCount,
    totalReviewsReported: source.totalReviewsReported,
    reviewsComplete: source.reviewsComplete,
    lastAnalyzedAt: source.lastAnalyzedAt?.toISOString() ?? null,
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
    <div className="pb-6">
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
    </div>
  );
}
