import { prisma } from "@/lib/prisma";
import { syncActiveCompetitors } from "@/lib/research/competitor-sync";
import { syncActiveBrandCompetitors } from "@/lib/brand-research/brand-competitor-sync";
import { syncActiveCompetitorProducts } from "@/lib/research/competitor-product-sync";
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
 *
 * Setiap eksekusi dicatat ke `ResearchCronRun` — dipakai panel kesehatan data
 * di dashboard untuk mendeteksi cron yang tidak terpasang / mati (data basi).
 */

async function runLogged<T>(
  mode: string,
  fn: () => Promise<T>,
): Promise<Response> {
  const run = await prisma.researchCronRun.create({
    data: { mode, status: "RUNNING" },
  });
  try {
    const result = await fn();
    await prisma.researchCronRun.update({
      where: { id: run.id },
      data: {
        status: "COMPLETED",
        finishedAt: new Date(),
        detail: JSON.stringify(result).slice(0, 1000),
      },
    });
    return Response.json({ ok: true, mode, result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.researchCronRun.update({
      where: { id: run.id },
      data: { status: "FAILED", finishedAt: new Date(), detail: message },
    });
    return Response.json({ ok: false, mode, error: message }, { status: 500 });
  }
}

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
    return runLogged(mode, async () => {
      const [shops, brandShops, products] = await Promise.all([
        syncActiveCompetitors(),
        syncActiveBrandCompetitors(),
        syncActiveCompetitorProducts(),
      ]);
      return { shops, brandShops, products };
    });
  }

  if (mode === "trends") {
    return runLogged(mode, () => syncWeeklyTrends());
  }

  if (mode === "social") {
    return runLogged(mode, () => syncActiveMonitors());
  }

  if (mode === "reports") {
    return runLogged(mode, () => syncWeeklyReports());
  }

  if (mode === "full") {
    return runLogged(mode, async () => {
      await pollRunningResearchJobs();
      const [competitors, brandCompetitors, competitorProducts, trends, social, reports] =
        await Promise.all([
          syncActiveCompetitors(),
          syncActiveBrandCompetitors(),
          syncActiveCompetitorProducts(),
          syncWeeklyTrends(),
          syncActiveMonitors(),
          syncWeeklyReports(),
        ]);
      return {
        competitors,
        brandCompetitors,
        competitorProducts,
        trends,
        social,
        reports,
      };
    });
  }

  return runLogged("poll", async () => {
    await pollRunningResearchJobs();
    return { polled: true };
  });
}
