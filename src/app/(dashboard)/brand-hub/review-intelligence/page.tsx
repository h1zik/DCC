import { Star } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHero } from "@/components/page-hero";
import { resumeStuckBrandJobs } from "@/lib/brand-research/run-apify-job";
import { ensureBrandHubPage } from "../layout";
import {
  BrandReviewIntelClient,
  type ReviewSourceRow,
} from "./brand-review-intel-client";

export default async function BrandReviewIntelligencePage() {
  const session = await ensureBrandHubPage();
  try {
    await resumeStuckBrandJobs();
  } catch (err) {
    console.error("[BrandReviewIntelligencePage] resumeStuckBrandJobs:", err);
  }

  const sources = await prisma.brandReviewSource.findMany({
    where: { createdById: session.user.id },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      productName: true,
      competitorBrand: true,
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
    <div className="flex w-full flex-col gap-6 pb-6">
      <PageHero
        icon={Star}
        title="Review Intel"
        subtitle="Analisis sentimen & keluhan/pujian konsumen dari multiple channel."
      />
      <BrandReviewIntelClient sources={rows} />
    </div>
  );
}
