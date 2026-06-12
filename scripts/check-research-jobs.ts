import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();

async function main() {
  const sources = await p.reviewIntelSource.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
    select: {
      id: true,
      status: true,
      errorMessage: true,
      productUrl: true,
      reviewCount: true,
    },
  });
  const jobs = await p.researchScrapeJob.findMany({
    orderBy: { createdAt: "desc" },
    take: 8,
  });
  const comps = await p.researchCompetitor.findMany({
    take: 5,
    include: { _count: { select: { skus: true } } },
  });
  console.log(JSON.stringify({ sources, jobs, comps }, null, 2));
}

main()
  .finally(() => p.$disconnect());
