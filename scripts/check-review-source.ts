import "dotenv/config";
import { prisma } from "../src/lib/prisma";

async function main() {
  const id = process.argv[2] ?? "cmqced3qw000dupx848gol4qw";
  const s = await prisma.reviewIntelSource.findUnique({
    where: { id },
    include: { _count: { select: { reviews: true } } },
  });
  console.log(
    JSON.stringify(
      {
        status: s?.status,
        reviewCount: s?.reviewCount,
        totalReviewsReported: s?.totalReviewsReported,
        reviewsComplete: s?.reviewsComplete,
        reviewsAccessible: s?.reviewsAccessible,
        errorMessage: s?.errorMessage,
        rawReviewsInDb: s?._count.reviews,
      },
      null,
      2,
    ),
  );
  await prisma.$disconnect();
}

main();
