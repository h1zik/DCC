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
    dataNotice: crawl.dataNotice,
    errorMessage: crawl.errorMessage,
    issues,
  };

  return <CrawlerDetailClient crawl={detail} />;
}
