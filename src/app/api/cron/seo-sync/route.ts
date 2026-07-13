import { pruneDataForSeoCache } from "@/lib/seo/dataforseo/cache";
import { syncActiveRankProjects } from "@/lib/seo/rank-tracker/rank-sync";
import { pollRunningSiteCrawls } from "@/lib/seo/crawler/crawler";
import { refreshOpportunities } from "@/lib/seo/content/opportunity-feed";
import { sendWeeklyRankSummaries } from "@/lib/seo/rank-tracker/weekly-notify";
import { runDueCrawlSchedules } from "@/lib/seo/crawler/crawl-schedule";
import { syncGscDaily } from "@/lib/seo/gsc/sync";

/** Refresh feed Content Opportunities (best-effort setelah rank sync). */
async function refreshOpportunitiesSafe() {
  try {
    return await refreshOpportunities();
  } catch (err) {
    console.warn("[cron/seo-sync] refresh opportunities gagal", err);
    return { total: 0, pruned: 0 };
  }
}

/**
 * Cron SEO Toolkit. Lindungi dengan env `CRON_SECRET`
 * (header `Authorization: Bearer …`).
 *
 * Jadwalkan di Railway:
 * - Rank tracking: sekali sehari jam 05:00 WIB (`mode=ranks`)
 * - Poll crawl teknis: setiap 5 menit (`mode=crawl-poll`)
 * - Prune cache DataForSEO: harian (`mode=prune`) — opsional
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return Response.json(
      { error: "CRON_SECRET belum diset di environment." },
      { status: 503 },
    );
  }
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const url = new URL(request.url);
  const mode = url.searchParams.get("mode") ?? "ranks";

  if (mode === "crawl-poll") {
    const result = await pollRunningSiteCrawls();
    return Response.json({ ok: true, mode, ...result });
  }

  if (mode === "prune") {
    const result = await pruneDataForSeoCache();
    return Response.json({ ok: true, mode, ...result });
  }

  if (mode === "weekly") {
    const result = await sendWeeklyRankSummaries();
    return Response.json({ ok: true, mode, ...result });
  }

  if (mode === "crawls") {
    const result = await runDueCrawlSchedules();
    return Response.json({ ok: true, mode, ...result });
  }

  if (mode === "gsc") {
    const result = await syncGscDaily();
    return Response.json({ ok: true, mode, ...result });
  }

  if (mode === "full") {
    const [ranks, crawls, pruned] = await Promise.all([
      syncActiveRankProjects(),
      pollRunningSiteCrawls(),
      pruneDataForSeoCache(),
    ]);
    const opportunities = await refreshOpportunitiesSafe();
    return Response.json({ ok: true, mode, ranks, crawls, pruned, opportunities });
  }

  // default: ranks (+ refresh feed opportunities dari posisi terbaru)
  const result = await syncActiveRankProjects();
  const opportunities = await refreshOpportunitiesSafe();
  return Response.json({ ok: true, mode: "ranks", ...result, opportunities });
}
