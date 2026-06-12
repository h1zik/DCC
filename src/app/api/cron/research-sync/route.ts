import { syncActiveCompetitors } from "@/lib/research/competitor-sync";
import { pollRunningResearchJobs } from "@/lib/research/sync-jobs";

/**
 * Cron Research Hub: poll job Apify yang masih berjalan + scrape harian kompetitor.
 * Lindungi dengan env `CRON_SECRET` (header `Authorization: Bearer …`).
 *
 * Jadwalkan di Railway:
 * - Poll jobs: setiap 5 menit
 * - Competitor sync: sekali sehari jam 06:00 WIB (gunakan cron terpisah atau flag query)
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

  await pollRunningResearchJobs();

  if (mode === "full") {
    const result = await syncActiveCompetitors();
    return Response.json({ ok: true, mode: "full", competitors: result });
  }

  return Response.json({ ok: true, mode: "poll" });
}
