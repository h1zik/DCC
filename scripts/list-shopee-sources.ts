import "dotenv/config";
import { prisma } from "../src/lib/prisma";

async function main() {
  const sources = await prisma.reviewIntelSource.findMany({
    where: { marketplace: "SHOPEE" },
    orderBy: { updatedAt: "desc" },
    take: 3,
    include: { _count: { select: { reviews: true } } },
  });
  for (const s of sources) {
    console.log({
      id: s.id,
      name: s.productName.slice(0, 40),
      status: s.status,
      reviewCount: s.reviewCount,
      accessible: s.reviewsAccessible,
      total: s.totalReviewsReported,
      inDb: s._count.reviews,
      updated: s.updatedAt.toISOString(),
    });
  }
  await prisma.$disconnect();
}

main();
