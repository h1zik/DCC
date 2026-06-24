import "dotenv/config";
import { prisma } from "../src/lib/prisma";

async function main() {
  const tracks = await prisma.competitorProductTrack.findMany({
    take: 5,
    orderBy: { updatedAt: "desc" },
    select: {
      productUrl: true,
      marketplace: true,
      name: true,
      scrapeError: true,
    },
  });
  console.log(JSON.stringify(tracks, null, 2));
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
