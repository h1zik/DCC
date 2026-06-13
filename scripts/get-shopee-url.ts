import "dotenv/config";
import { prisma } from "../src/lib/prisma";

async function main() {
  const source = await prisma.reviewIntelSource.findFirst({
    where: { marketplace: "SHOPEE" },
    orderBy: { createdAt: "desc" },
    select: { productUrl: true, productName: true },
  });

  console.log(source);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
