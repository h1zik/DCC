import { notFound } from "next/navigation";
import { SeoIssueSeverity } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  CrawlerDetailClient,
  type CrawlDetail,
  type CrawlIssueRow,
} from "./crawler-detail-client";

const SEVERITY_ORDER: Record<SeoIssueSeverity, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
  INFO: 4,
};

export default async function SeoCrawlerDetailPage({
  params,
}: {
  params: Promise<{ crawlId: string }>;
}) {
  const { crawlId } = await params;

  const crawl = await prisma.seoSiteCrawl.findUnique({
    where: { id: crawlId },
    include: { issues: true },
  });
  if (!crawl) notFound();

  const issues: CrawlIssueRow[] = crawl.issues
    .map((i) => ({
      id: i.id,
      type: i.type,
      severity: i.severity,
      count: i.count,
      url: i.url,
      message: i.message,
    }))
    .sort(
      (a, b) =>
        SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
        b.count - a.count,
    );

  // Tren health score: crawl READY untuk domain yang sama (maks 12 terakhir).
  const historyRows = await prisma.seoSiteCrawl.findMany({
    where: { domain: crawl.domain, status: "READY", healthScore: { not: null } },
    orderBy: { createdAt: "asc" },
    select: { id: true, healthScore: true, createdAt: true },
    take: 12,
  });

  const detail: CrawlDetail = {
    id: crawl.id,
    name: crawl.name,
    domain: crawl.domain,
    status: crawl.status,
    pagesCrawled: crawl.pagesCrawled,
    maxPages: crawl.maxPages,
    includeLighthouse: crawl.includeLighthouse,
    summary: (crawl.summary as Record<string, unknown> | null) ?? null,
    lighthouse: (crawl.lighthouse as CrawlDetail["lighthouse"]) ?? null,
    healthScore: crawl.healthScore,
    issueDiff: (crawl.issueDiff as CrawlDetail["issueDiff"]) ?? null,
    healthHistory: historyRows.map((h) => ({
      date: h.createdAt.toISOString().slice(0, 10),
      score: h.healthScore!,
      current: h.id === crawl.id,
    })),
    dataNotice: crawl.dataNotice,
    errorMessage: crawl.errorMessage,
    issues,
  };

  return <CrawlerDetailClient crawl={detail} />;
}
