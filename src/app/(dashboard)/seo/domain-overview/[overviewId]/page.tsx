import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import type {
  CompetitorDomain,
  DomainHistoryPoint,
  DomainRankOverview,
  RankedKeyword,
} from "@/lib/seo/dataforseo/labs-domain";
import {
  DomainOverviewDetailClient,
  type DomainOverviewDetail,
} from "./domain-overview-detail-client";

export default async function SeoDomainOverviewDetailPage({
  params,
}: {
  params: Promise<{ overviewId: string }>;
}) {
  const { overviewId } = await params;

  const row = await prisma.seoDomainOverview.findUnique({
    where: { id: overviewId },
  });
  if (!row) notFound();

  const detail: DomainOverviewDetail = {
    id: row.id,
    target: row.target,
    status: row.status,
    overview:
      row.overview && typeof row.overview === "object" && !Array.isArray(row.overview)
        ? (row.overview as DomainRankOverview)
        : null,
    topKeywords: Array.isArray(row.topKeywords)
      ? (row.topKeywords as unknown as RankedKeyword[])
      : [],
    competitors: Array.isArray(row.competitors)
      ? (row.competitors as unknown as CompetitorDomain[])
      : [],
    history: Array.isArray(row.history)
      ? (row.history as unknown as DomainHistoryPoint[])
      : [],
    dataNotice: row.dataNotice,
    errorMessage: row.errorMessage,
  };

  return <DomainOverviewDetailClient detail={detail} />;
}
