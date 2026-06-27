import { pruneDataForSeoCache } from "@/lib/seo/dataforseo/cache";
import { syncActiveRankProjects } from "@/lib/seo/rank-tracker/rank-sync";
import { pollRunningSiteCrawls } from "@/lib/seo/crawler/crawler";

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

  if (mode === "full") {
    const [ranks, crawls, pruned] = await Promise.all([
      syncActiveRankProjects(),
      pollRunningSiteCrawls(),
      pruneDataForSeoCache(),
    ]);
    return Response.json({ ok: true, mode, ranks, crawls, pruned });
  }

  // default: ranks
  const result = await syncActiveRankProjects();
  return Response.json({ ok: true, mode: "ranks", ...result });
}
