import "server-only";

import type { Prisma, ReviewSentiment } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  REVIEW_RAW_PAGE_SIZE,
  type ReviewRawPage,
  type ReviewRawRow,
  type ReviewSentimentFilter,
} from "@/lib/review-scrape/review-raw-types";

type RawReviewRecord = {
  id: string;
  externalId: string | null;
  author: string | null;
  rating: number | null;
  text: string;
  reviewDate: Date | null;
  analysis: { sentiment: ReviewSentiment } | null;
};

function mapRow(row: RawReviewRecord): ReviewRawRow {
  return {
    id: row.id,
    externalId: row.externalId,
    author: row.author,
    rating: row.rating,
    text: row.text,
    reviewDate: row.reviewDate?.toISOString() ?? null,
    sentiment: row.analysis?.sentiment ?? null,
  };
}

function buildSearchWhere(
  sourceId: string,
  search?: string,
  sentiment?: ReviewSentimentFilter,
): Prisma.ReviewRawWhereInput {
  const where: Prisma.ReviewRawWhereInput = { sourceId };
  const q = search?.trim();
  if (q) {
    where.OR = [
      { text: { contains: q, mode: "insensitive" } },
      { author: { contains: q, mode: "insensitive" } },
      { externalId: { contains: q, mode: "insensitive" } },
    ];
  }
  if (sentiment) {
    where.analysis = { is: { sentiment } };
  }
  return where;
}

function buildBrandSearchWhere(
  sourceId: string,
  search?: string,
  sentiment?: ReviewSentimentFilter,
): Prisma.BrandReviewItemWhereInput {
  const where: Prisma.BrandReviewItemWhereInput = { sourceId };
  const q = search?.trim();
  if (q) {
    where.OR = [
      { text: { contains: q, mode: "insensitive" } },
      { author: { contains: q, mode: "insensitive" } },
      { externalId: { contains: q, mode: "insensitive" } },
    ];
  }
  if (sentiment) {
    where.analysis = { is: { sentiment } };
  }
  return where;
}

function paginate(total: number, page: number, pageSize: number): ReviewRawPage {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return {
    rows: [],
    total,
    page,
    pageSize,
    totalPages,
  };
}

export async function queryResearchReviewRawPage(input: {
  sourceId: string;
  page?: number;
  pageSize?: number;
  search?: string;
  sentiment?: ReviewSentimentFilter;
}): Promise<ReviewRawPage> {
  const pageSize = input.pageSize ?? REVIEW_RAW_PAGE_SIZE;
  const page = Math.max(1, input.page ?? 1);
  const where = buildSearchWhere(input.sourceId, input.search, input.sentiment);

  const [total, rows] = await Promise.all([
    prisma.reviewRaw.count({ where }),
    prisma.reviewRaw.findMany({
      where,
      orderBy: [{ reviewDate: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        externalId: true,
        author: true,
        rating: true,
        text: true,
        reviewDate: true,
        analysis: { select: { sentiment: true } },
      },
    }),
  ]);

  const meta = paginate(total, page, pageSize);
  return { ...meta, rows: rows.map(mapRow) };
}

export async function queryBrandReviewRawPage(input: {
  sourceId: string;
  page?: number;
  pageSize?: number;
  search?: string;
  sentiment?: ReviewSentimentFilter;
}): Promise<ReviewRawPage> {
  const pageSize = input.pageSize ?? REVIEW_RAW_PAGE_SIZE;
  const page = Math.max(1, input.page ?? 1);
  const where = buildBrandSearchWhere(input.sourceId, input.search, input.sentiment);

  const [total, rows] = await Promise.all([
    prisma.brandReviewItem.count({ where }),
    prisma.brandReviewItem.findMany({
      where,
      orderBy: [{ reviewDate: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        externalId: true,
        author: true,
        rating: true,
        text: true,
        reviewDate: true,
        analysis: { select: { sentiment: true } },
      },
    }),
  ]);

  const meta = paginate(total, page, pageSize);
  return { ...meta, rows: rows.map(mapRow) };
}

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function rowsToCsv(rows: ReviewRawRow[]): string {
  const header = ["external_id", "author", "rating", "review_date", "sentiment", "text"];
  const lines = rows.map((r) =>
    [
      r.externalId ?? "",
      r.author ?? "",
      r.rating != null ? String(r.rating) : "",
      r.reviewDate ? r.reviewDate.slice(0, 10) : "",
      r.sentiment ?? "",
      r.text,
    ]
      .map(csvEscape)
      .join(","),
  );
  return [header.join(","), ...lines].join("\n");
}

export async function exportResearchReviewRawCsv(
  sourceId: string,
  search?: string,
  sentiment?: ReviewSentimentFilter,
): Promise<string> {
  const where = buildSearchWhere(sourceId, search, sentiment);
  const rows = await prisma.reviewRaw.findMany({
    where,
    orderBy: [{ reviewDate: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      externalId: true,
      author: true,
      rating: true,
      text: true,
      reviewDate: true,
      analysis: { select: { sentiment: true } },
    },
  });
  return rowsToCsv(rows.map(mapRow));
}

export async function exportBrandReviewRawCsv(
  sourceId: string,
  search?: string,
  sentiment?: ReviewSentimentFilter,
): Promise<string> {
  const where = buildBrandSearchWhere(sourceId, search, sentiment);
  const rows = await prisma.brandReviewItem.findMany({
    where,
    orderBy: [{ reviewDate: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      externalId: true,
      author: true,
      rating: true,
      text: true,
      reviewDate: true,
      analysis: { select: { sentiment: true } },
    },
  });
  return rowsToCsv(rows.map(mapRow));
}
