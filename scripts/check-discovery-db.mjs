import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();

try {
  const queries = await p.productDiscoveryQuery.findMany({
    orderBy: { createdAt: "desc" },
    take: 8,
    include: { _count: { select: { products: true } } },
  });
  console.log("=== Recent Product Discovery Queries ===");
  for (const q of queries) {
    console.log(
      JSON.stringify(
        {
          id: q.id,
          keyword: q.keyword,
          status: q.status,
          limit: q.productLimit,
          marketplaces: q.marketplaces,
          productCount: q.productCount,
          itemsInDb: q._count.products,
          error: q.errorMessage,
          scrapeState: q.scrapeState,
          updatedAt: q.updatedAt,
        },
        null,
        2,
      ),
    );
  }

  const jobs = await p.researchScrapeJob.findMany({
    where: { type: "PRODUCT_DISCOVERY" },
    orderBy: { createdAt: "desc" },
    take: 8,
  });
  console.log("\n=== Recent Discovery Jobs ===");
  for (const j of jobs) {
    console.log(
      JSON.stringify(
        {
          id: j.id,
          entityId: j.entityId,
          status: j.status,
          error: j.error,
          apifyRunId: j.apifyRunId,
          startedAt: j.startedAt,
          completedAt: j.completedAt,
        },
        null,
        2,
      ),
    );
  }
  const competitors = await p.researchCompetitor.findMany({
    orderBy: { updatedAt: "desc" },
    take: 5,
    select: {
      id: true,
      name: true,
      marketplace: true,
      status: true,
      errorMessage: true,
      scrapeState: true,
      updatedAt: true,
      _count: { select: { skus: true } },
    },
  });
  console.log("\n=== Recent Competitors ===");
  for (const c of competitors) {
    console.log(
      JSON.stringify(
        {
          name: c.name,
          marketplace: c.marketplace,
          status: c.status,
          skus: c._count.skus,
          error: c.errorMessage,
          scrapeState: c.scrapeState,
          updatedAt: c.updatedAt,
        },
        null,
        2,
      ),
    );
  }
} finally {
  await p.$disconnect();
}
