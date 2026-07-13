import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import type { GapRow, GapSummary } from "@/lib/seo/keyword-gap/gap-logic";
import {
  KeywordGapDetailClient,
  type KeywordGapDetail,
} from "./keyword-gap-detail-client";

export default async function SeoKeywordGapDetailPage({
  params,
}: {
  params: Promise<{ gapId: string }>;
}) {
  const { gapId } = await params;

  const gap = await prisma.seoKeywordGap.findUnique({ where: { id: gapId } });
  if (!gap) notFound();

  const detail: KeywordGapDetail = {
    id: gap.id,
    name: gap.name,
    target: gap.target,
    competitors: gap.competitors,
    status: gap.status,
    rows: Array.isArray(gap.rows) ? (gap.rows as unknown as GapRow[]) : [],
    summary:
      gap.summary && typeof gap.summary === "object" && !Array.isArray(gap.summary)
        ? (gap.summary as unknown as GapSummary)
        : null,
    dataNotice: gap.dataNotice,
    errorMessage: gap.errorMessage,
  };

  return <KeywordGapDetailClient detail={detail} />;
}
