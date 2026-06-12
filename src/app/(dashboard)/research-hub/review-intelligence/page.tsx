import { Star } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { resumeStuckResearchJobs } from "@/lib/research/run-apify-job";
import { PageHero } from "@/components/page-hero";
import {
  ReviewIntelligenceClient,
  type ReviewSourceRow,
} from "./review-intelligence-client";

export default async function ReviewIntelligencePage() {
  await resumeStuckResearchJobs();

  const sources = await prisma.reviewIntelSource.findMany({
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      productName: true,
      competitorBrand: true,
      marketplace: true,
      productUrl: true,
      status: true,
      reviewCount: true,
      lastAnalyzedAt: true,
      errorMessage: true,
    },
  });

  const rows: ReviewSourceRow[] = sources.map((s) => ({
    ...s,
    lastAnalyzedAt: s.lastAnalyzedAt?.toISOString() ?? null,
  }));

  return (
    <div className="flex w-full flex-col gap-6 pb-6">
      <PageHero
        icon={Star}
        title="Review Intelligence"
        subtitle="Scrape ribuan review kompetitor — sentimen, keluhan, pujian, dan gap opportunity."
      />
      <ReviewIntelligenceClient sources={rows} />
    </div>
  );
}
