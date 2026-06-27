import { Bug } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { SeoModulePage } from "@/components/seo/seo-module-page";
import { CrawlerClient, type CrawlRow } from "./crawler-client";

export default async function SeoCrawlerPage() {
  const crawls = await prisma.seoSiteCrawl.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { issues: true } } },
  });

  const rows: CrawlRow[] = crawls.map((c) => ({
    id: c.id,
    name: c.name,
    domain: c.domain,
    status: c.status,
    pagesCrawled: c.pagesCrawled,
    maxPages: c.maxPages,
    includeLighthouse: c.includeLighthouse,
    issueCount: c._count.issues,
    errorMessage: c.errorMessage,
    createdAt: c.createdAt.toISOString(),
  }));

  return (
    <SeoModulePage
      icon={Bug}
      title="Technical SEO Crawler"
      description="Crawl satu domain: broken link, redirect, status code, duplicate/missing meta, sitemap/robots, dan Core Web Vitals. Isu disusun berdasarkan prioritas."
    >
      <CrawlerClient crawls={rows} />
    </SeoModulePage>
  );
}
