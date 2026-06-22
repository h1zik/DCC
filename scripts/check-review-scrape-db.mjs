import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();

try {
  const sources = await p.reviewIntelSource.findMany({
    where: { platformKey: "shopee" },
    orderBy: { updatedAt: "desc" },
    take: 5,
    select: {
      id: true,
      productName: true,
      status: true,
      errorMessage: true,
      reviewCount: true,
      lastAnalyzedAt: true,
      productUrl: true,
    },
  });
  console.log("=== Shopee Review Sources ===");
  for (const s of sources) {
    console.log(JSON.stringify(s, null, 2));
  }

  const jobs = await p.researchScrapeJob.findMany({
    where: { type: "REVIEW_SCRAPE" },
    orderBy: { createdAt: "desc" },
    take: 8,
    select: {
      id: true,
      entityId: true,
      status: true,
      error: true,
      apifyRunId: true,
      startedAt: true,
      completedAt: true,
    },
  });
  console.log("\n=== Recent Review Scrape Jobs ===");
  for (const j of jobs) {
    console.log(JSON.stringify(j, null, 2));
  }
} finally {
  await p.$disconnect();
}
