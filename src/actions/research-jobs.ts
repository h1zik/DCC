"use server";

import { prisma } from "@/lib/prisma";
import { requireMarketAnalyst } from "@/lib/research/auth";

export type ResearchJobSummary = {
  id: string;
  type: string;
  entityId: string;
  status: string;
  percent: number;
  stepLabel: string | null;
  startedAt: string | null;
  /** Human label for the indicator, resolved from the related entity. */
  label: string;
  /** Deep link back into the relevant Research Hub module. */
  href: string;
};

const TYPE_LABEL: Record<string, string> = {
  REVIEW_SCRAPE: "Review Intelligence",
  COMPETITOR_SNAPSHOT: "Competitor Tracker (Shop)",
  COMPETITOR_PRODUCT_SNAPSHOT: "Competitor Tracker (Product)",
  PRODUCT_DISCOVERY: "Product Discovery",
  PINTEREST_SCRAPE: "Pinterest Scrape",
  VISUAL_HARVEST: "Visual Harvest",
};

/**
 * Ambang job dianggap "hantu" (orphaned). Di Railway proses bisa mati di
 * tengah scrape (redeploy/scale-down/request timeout) sehingga job tidak
 * pernah jadi COMPLETED/FAILED dan indikator nyangkut selamanya.
 *
 * - Job in-process (tanpa apifyRunId) bisa berjalan lama: satu run VPS dapat
 *   memakan hingga ~15 menit (timeout 900s) dan run Shopee mengantre cooldown
 *   ~1 menit → reap setelah 20 menit agar tidak mematikan job yang masih sah.
 * - Job yang sudah diserahkan ke Apify (punya apifyRunId) bisa jalan lama →
 *   beri 30 menit; bila ternyata Apify sukses, `recoverMisclassifiedReviewScrapeJobs`
 *   masih bisa memulihkannya karena pesan errornya mengandung "batas waktu".
 */
const STALE_INPROCESS_MS = 20 * 60_000;
const STALE_APIFY_MS = 30 * 60_000;

/**
 * Returns active (PENDING/RUNNING) research scrape jobs for the background
 * indicator. Lightweight: only joins the entity name for the label.
 *
 * Sebelum mengembalikan data, job yang sudah melewati batas waktu ditandai
 * FAILED supaya indikator tidak menampilkan proses yang sebenarnya sudah mati.
 */
export async function listActiveResearchJobs(): Promise<ResearchJobSummary[]> {
  await requireMarketAnalyst();

  const candidateJobs = await prisma.researchScrapeJob.findMany({
    where: { status: { in: ["PENDING", "RUNNING"] } },
    orderBy: { startedAt: "asc" },
    take: 20,
  });

  if (candidateJobs.length === 0) return [];

  // Pisahkan job yang masih hidup dari job hantu (orphaned) berdasarkan umur.
  const now = Date.now();
  const staleIds: string[] = [];
  const jobs = candidateJobs.filter((job) => {
    const startedMs = (job.startedAt ?? job.createdAt).getTime();
    const limit = job.apifyRunId ? STALE_APIFY_MS : STALE_INPROCESS_MS;
    if (now - startedMs > limit) {
      staleIds.push(job.id);
      return false;
    }
    return true;
  });

  // Reap job hantu — self-healing tiap kali indikator polling.
  if (staleIds.length > 0) {
    await prisma.researchScrapeJob.updateMany({
      where: { id: { in: staleIds }, status: { in: ["PENDING", "RUNNING"] } },
      data: {
        status: "FAILED",
        error:
          "Proses melewati batas waktu (timeout) — ditandai gagal otomatis. Silakan refresh atau jalankan ulang.",
        completedAt: new Date(),
      },
    });
  }

  if (jobs.length === 0) return [];

  const entityIds = Array.from(new Set(jobs.map((j) => j.entityId)));
  const [reviewSources, competitors, productTracks, discoveryQueries] =
    await Promise.all([
    prisma.reviewIntelSource.findMany({
      where: { id: { in: entityIds } },
      select: { id: true, productName: true },
    }),
    prisma.researchCompetitor.findMany({
      where: { id: { in: entityIds } },
      select: { id: true, name: true },
    }),
    prisma.competitorProductTrack.findMany({
      where: { id: { in: entityIds } },
      select: { id: true, name: true, categoryId: true },
    }),
    prisma.productDiscoveryQuery.findMany({
      where: { id: { in: entityIds } },
      select: { id: true, keyword: true },
    }).catch(() => []),
  ]);

  const reviewName = new Map(reviewSources.map((r) => [r.id, r.productName]));
  const competitorName = new Map(competitors.map((c) => [c.id, c.name]));
  const productTrackName = new Map(
    productTracks.map((t) => [t.id, t.name]),
  );
  const productTrackCategory = new Map(
    productTracks.map((t) => [t.id, t.categoryId]),
  );
  const discoveryQuery = new Map(
    (discoveryQueries as { id: string; keyword: string }[]).map((d) => [
      d.id,
      d.keyword,
    ]),
  );

  return jobs.map((job) => {
    let label: string;
    let href: string;
    switch (job.type) {
      case "REVIEW_SCRAPE":
        label = reviewName.get(job.entityId) ?? "Review source";
        href = `/research-hub/review-intelligence/${job.entityId}`;
        break;
      case "COMPETITOR_SNAPSHOT":
        label = competitorName.get(job.entityId) ?? "Competitor";
        href = `/research-hub/competitor-tracker/${job.entityId}`;
        break;
      case "COMPETITOR_PRODUCT_SNAPSHOT":
        label = productTrackName.get(job.entityId) ?? "Produk kompetitor";
        href = productTrackCategory.has(job.entityId)
          ? `/research-hub/competitor-tracker/products/${productTrackCategory.get(job.entityId)}/tracks/${job.entityId}`
          : "/research-hub/competitor-tracker/products";
        break;
      case "PRODUCT_DISCOVERY":
        label = discoveryQuery.get(job.entityId) ?? "Product Discovery";
        href = `/research-hub/product-discovery/${job.entityId}`;
        break;
      default:
        label = TYPE_LABEL[job.type] ?? job.type;
        href = "/research-hub";
    }
    return {
      id: job.id,
      type: job.type,
      entityId: job.entityId,
      status: job.status,
      percent: job.percent,
      stepLabel: job.stepLabel,
      startedAt: job.startedAt ? job.startedAt.toISOString() : null,
      label,
      href,
    };
  });
}