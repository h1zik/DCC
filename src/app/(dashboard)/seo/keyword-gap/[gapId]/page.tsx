import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ensureSeoPage } from "@/lib/seo/auth";
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
  await ensureSeoPage();
  const { gapId } = await params;

  const gap = await prisma.seoKeywordGap.findUnique({ where: { id: gapId } });
  if (!gap) notFound();

  const storedSummary =
    gap.summary && typeof gap.summary === "object" && !Array.isArray(gap.summary)
      ? (gap.summary as unknown as GapSummary)
      : null;
  const hasStoredRows = Array.isArray(gap.rows) && gap.rows.length > 0;
  const isLegacy = hasStoredRows && storedSummary?.version !== 2;

  const detail: KeywordGapDetail = {
    id: gap.id,
    name: gap.name,
    target: gap.target,
    competitors: gap.competitors,
    status: gap.status,
    rows:
      !isLegacy && Array.isArray(gap.rows)
        ? (gap.rows as unknown as GapRow[])
        : [],
    summary: isLegacy ? null : storedSummary,
    dataNotice: isLegacy
      ? "Hasil ini dibuat dengan mesin Keyword Gap lama dan tidak lagi dianggap valid. Klik Refresh untuk menghitung ulang dengan data organik terbaru."
      : gap.dataNotice,
    errorMessage: gap.errorMessage,
  };

  return <KeywordGapDetailClient detail={detail} />;
}
