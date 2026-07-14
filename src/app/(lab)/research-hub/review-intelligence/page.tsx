import { Star } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { resumeStuckResearchJobs } from "@/lib/research/run-apify-job";
import { ResearchHubModulePage } from "@/components/research-hub/research-hub-module-page";
import {
  ReviewIntelligenceClient,
  type ReviewSourceRow,
} from "./review-intelligence-client";

export default async function ReviewIntelligencePage() {
  try {
    await resumeStuckResearchJobs();
  } catch (err) {
    console.error("[ReviewIntelligencePage] resumeStuckResearchJobs:", err);
  }

  const sources = await prisma.reviewIntelSource.findMany({
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      productName: true,
      competitorBrand: true,
      platformKey: true,
      marketplace: true,
      productUrl: true,
      status: true,
      reviewCount: true,
      totalReviewsReported: true,
      reviewsComplete: true,
      lastAnalyzedAt: true,
      errorMessage: true,
    },
  });

  const rows: ReviewSourceRow[] = sources.map((s) => ({
    ...s,
    lastAnalyzedAt: s.lastAnalyzedAt?.toISOString() ?? null,
  }));

  return (
    <ResearchHubModulePage
      icon={Star}
      title="Review Intelligence"
      description="Scrape ribuan review kompetitor — sentimen, keluhan, pujian, dan gap opportunity."
    >
      <ReviewIntelligenceClient sources={rows} />
    </ResearchHubModulePage>
  );
}
