import { Star } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { resumeStuckBrandJobs } from "@/lib/brand-research/run-apify-job";
import { BrandHubListPage } from "@/components/brand-hub/brand-hub-list-page";
import { ensureBrandHubPage } from "../layout";
import {
  BrandReviewIntelClient,
  type BrandReviewSourceRow,
} from "./brand-review-intel-client";

export default async function BrandReviewIntelligencePage() {
  await ensureBrandHubPage();

  try {
    await resumeStuckBrandJobs();
  } catch (err) {
    console.error("[BrandReviewIntelligencePage] resumeStuckBrandJobs:", err);
  }

  const sources = await prisma.brandReviewSource.findMany({
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

  const rows: BrandReviewSourceRow[] = sources.map((s) => ({
    ...s,
    lastAnalyzedAt: s.lastAnalyzedAt?.toISOString() ?? null,
  }));

  return (
    <BrandHubListPage
      icon={Star}
      eyebrow="Market Intelligence"
      title="Review Intelligence"
      subtitle="Scrape ribuan review kompetitor — sentimen, keluhan, pujian, dan gap opportunity."
    >
      <BrandReviewIntelClient sources={rows} />
    </BrandHubListPage>
  );
}
