"use server";

import { prisma } from "@/lib/prisma";
import { requireMarketAnalyst } from "@/lib/research/auth";

export type ResearchJobSummary = {
  id: string;
  type: string;
  entityId: string;
  status: string;
  percent: number;
  stepLabel: string | null;
  startedAt: string | null;
  /** Human label for the indicator, resolved from the related entity. */
  label: string;
  /** Deep link back into the relevant Research Hub module. */
  href: string;
};

const TYPE_LABEL: Record<string, string> = {
  REVIEW_SCRAPE: "Review Intelligence",
  COMPETITOR_SNAPSHOT: "Competitor Tracker",
  PRODUCT_DISCOVERY: "Product Discovery",
  PINTEREST_SCRAPE: "Pinterest Scrape",
  VISUAL_HARVEST: "Visual Harvest",
};

/**
 * Returns active (PENDING/RUNNING) research scrape jobs for the background
 * indicator. Lightweight: only joins the entity name for the label.
 */
export async function listActiveResearchJobs(): Promise<ResearchJobSummary[]> {
  await requireMarketAnalyst();

  const jobs = await prisma.researchScrapeJob.findMany({
    where: { status: { in: ["PENDING", "RUNNING"] } },
    orderBy: { startedAt: "asc" },
    take: 10,
  });

  if (jobs.length === 0) return [];

  const entityIds = Array.from(new Set(jobs.map((j) => j.entityId)));
  const [reviewSources, competitors, discoveryQueries] = await Promise.all([
    prisma.reviewIntelSource.findMany({
      where: { id: { in: entityIds } },
      select: { id: true, productName: true },
    }),
    prisma.researchCompetitor.findMany({
      where: { id: { in: entityIds } },
      select: { id: true, name: true },
    }),
    prisma.productDiscoveryQuery.findMany({
      where: { id: { in: entityIds } },
      select: { id: true, keyword: true },
    }).catch(() => []),
  ]);

  const reviewName = new Map(reviewSources.map((r) => [r.id, r.productName]));
  const competitorName = new Map(competitors.map((c) => [c.id, c.name]));
  const discoveryQuery = new Map(
    (discoveryQueries as { id: string; keyword: string }[]).map((d) => [
      d.id,
      d.keyword,
    ]),
  );

  return jobs.map((job) => {
    let label: string;
    let href: string;
    switch (job.type) {
      case "REVIEW_SCRAPE":
        label = reviewName.get(job.entityId) ?? "Review source";
        href = `/research-hub/review-intelligence/${job.entityId}`;
        break;
      case "COMPETITOR_SNAPSHOT":
        label = competitorName.get(job.entityId) ?? "Competitor";
        href = `/research-hub/competitor-tracker/${job.entityId}`;
        break;
      case "PRODUCT_DISCOVERY":
        label = discoveryQuery.get(job.entityId) ?? "Product Discovery";
        href = `/research-hub/product-discovery/${job.entityId}`;
        break;
      default:
        label = TYPE_LABEL[job.type] ?? job.type;
        href = "/research-hub";
    }
    return {
      id: job.id,
      type: job.type,
      entityId: job.entityId,
      status: job.status,
      percent: job.percent,
      stepLabel: job.stepLabel,
      startedAt: job.startedAt ? job.startedAt.toISOString() : null,
      label,
      href,
    };
  });
}