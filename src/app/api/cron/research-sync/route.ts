import { syncActiveCompetitors } from "@/lib/research/competitor-sync";
import { syncWeeklyReports } from "@/lib/research/reports/weekly-report-sync";
import { syncActiveMonitors } from "@/lib/research/social-listening/social-sync";
import { pollRunningResearchJobs } from "@/lib/research/sync-jobs";
import { syncWeeklyTrends } from "@/lib/research/trend-radar/trend-sync";

/**
 * Cron Research Hub: poll job Apify yang masih berjalan + scrape harian kompetitor.
 * Lindungi dengan env `CRON_SECRET` (header `Authorization: Bearer …`).
 *
 * Jadwalkan di Railway:
 * - Poll jobs: setiap 5 menit (`mode=poll`)
 * - Competitor sync: sekali sehari jam 06:00 WIB (`mode=competitors`)
 * - Trend Radar digest: Senin jam 06:00 WIB (`mode=trends`)
 * - Social Listening sync: harian jam 06:00 WIB (`mode=social`)
 * - Research Reports weekly: Senin jam 06:00 WIB (`mode=reports`)
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
  const mode = url.searchParams.get("mode") ?? "poll";

  if (mode === "competitors") {
    const result = await syncActiveCompetitors();
    return Response.json({ ok: true, mode, ...result });
  }

  if (mode === "trends") {
    const result = await syncWeeklyTrends();
    return Response.json({ ok: true, mode, ...result });
  }

  if (mode === "social") {
    const result = await syncActiveMonitors();
    return Response.json({ ok: true, mode, ...result });
  }

  if (mode === "reports") {
    const result = await syncWeeklyReports();
    return Response.json({ ok: true, mode, ...result });
  }

  await pollRunningResearchJobs();

  if (mode === "full") {
    const [competitors, trends, social, reports] = await Promise.all([
      syncActiveCompetitors(),
      syncWeeklyTrends(),
      syncActiveMonitors(),
      syncWeeklyReports(),
    ]);
    return Response.json({
      ok: true,
      mode: "full",
      competitors,
      trends,
      social,
      reports,
    });
  }

  return Response.json({ ok: true, mode: "poll" });
}
