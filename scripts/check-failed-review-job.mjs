import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APIFY_BASE = "https://api.apify.com/v2";
const token = process.env.APIFY_API_TOKEN?.trim();

async function apifyStatus(runId) {
  if (!token) return null;
  const res = await fetch(
    `${APIFY_BASE}/actor-runs/${runId}?token=${encodeURIComponent(token)}`,
  );
  if (!res.ok) return { error: res.status };
  const json = await res.json();
  return json.data;
}

async function main() {
  const sources = await prisma.reviewIntelSource.findMany({
    where: { status: "FAILED" },
    orderBy: { updatedAt: "desc" },
    take: 5,
  });

  for (const s of sources) {
    const job = await prisma.researchScrapeJob.findFirst({
      where: { entityId: s.id, type: "REVIEW_SCRAPE" },
      orderBy: { createdAt: "desc" },
    });
    console.log("\n---");
    console.log("url:", s.productUrl);
    console.log("product:", s.productName.slice(0, 60));
    console.log("source status:", s.status, "| error:", s.errorMessage);
    if (job) {
      console.log("job:", job.id, job.status, job.apifyRunId);
      console.log("job error:", job.error);
      console.log("started:", job.startedAt, "completed:", job.completedAt);
      if (job.apifyRunId) {
        const run = await apifyStatus(job.apifyRunId);
        console.log("apify run:", run?.status, "| started:", run?.startedAt, "| finished:", run?.finishedAt);
      }
    }
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
