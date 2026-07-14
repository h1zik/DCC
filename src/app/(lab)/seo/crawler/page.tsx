import { Bug } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { SeoModulePage } from "@/components/seo/seo-module-page";
import { CrawlerClient, type CrawlRow } from "./crawler-client";
import {
  CrawlScheduleSection,
  type CrawlScheduleRow,
} from "./crawl-schedule-section";

export default async function SeoCrawlerPage() {
  const [crawls, schedules] = await Promise.all([
    prisma.seoSiteCrawl.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { issues: true } } },
    }),
    prisma.seoCrawlSchedule.findMany({ orderBy: { createdAt: "desc" } }),
  ]);

  const rows: CrawlRow[] = crawls.map((c) => ({
    id: c.id,
    name: c.name,
    domain: c.domain,
    status: c.status,
    pagesCrawled: c.pagesCrawled,
    maxPages: c.maxPages,
    includeLighthouse: c.includeLighthouse,
    issueCount: c._count.issues,
    healthScore: c.healthScore,
    errorMessage: c.errorMessage,
    createdAt: c.createdAt.toISOString(),
  }));

  const scheduleRows: CrawlScheduleRow[] = schedules.map((s) => ({
    id: s.id,
    domain: s.domain,
    maxPages: s.maxPages,
    frequency: s.frequency,
    isActive: s.isActive,
    nextRunAt: s.nextRunAt.toISOString(),
    lastCrawlId: s.lastCrawlId,
  }));

  return (
    <SeoModulePage
      icon={Bug}
      title="Technical SEO Crawler"
      description="Crawl satu domain: broken link, redirect, status code, duplicate/missing meta, sitemap/robots, dan Core Web Vitals. Isu disusun berdasarkan prioritas — bisa dijadwalkan berulang."
    >
      <CrawlScheduleSection schedules={scheduleRows} />
      <CrawlerClient crawls={rows} />
    </SeoModulePage>
  );
}
