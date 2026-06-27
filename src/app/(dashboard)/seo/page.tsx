import Link from "next/link";
import {
  Bug,
  FileText,
  Gauge,
  LineChart,
  ListChecks,
  PenLine,
  Search,
  Store,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { SeoModulePage } from "@/components/seo/seo-module-page";
import { SeoRankTrendChart } from "@/components/seo/seo-rank-trend-chart";
import {
  ResearchHubSection,
  ResearchHubStatChip,
  hub,
} from "@/components/research-hub/research-hub-primitives";
import { cn } from "@/lib/utils";
import { formatRankPosition, scoreToneClass } from "@/lib/seo/labels";

/** Batas waktu grafik tren dashboard (30 hari terakhir). */
function dashboardCutoff(): Date {
  return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
}

export default async function SeoOverviewPage() {
  const [
    keywordCount,
    trackedCount,
    avgPos,
    technicalIssues,
    auditAgg,
    snapshots,
    recentAudits,
  ] = await Promise.all([
    prisma.seoKeyword.count(),
    prisma.seoTrackedKeyword.count(),
    prisma.seoTrackedKeyword.aggregate({
      _avg: { lastPosition: true },
      where: { lastPosition: { not: null } },
    }),
    prisma.seoCrawlIssue.count(),
    prisma.seoOnPageAudit.aggregate({
      _avg: { score: true },
      where: { score: { not: null } },
    }),
    prisma.seoRankSnapshot.findMany({
      where: { capturedAt: { gte: dashboardCutoff() }, position: { not: null } },
      select: { position: true, capturedAt: true },
      orderBy: { capturedAt: "asc" },
    }),
    prisma.seoOnPageAudit.findMany({
      where: { status: "READY" },
      orderBy: { createdAt: "desc" },
      select: { id: true, url: true, score: true },
      take: 6,
    }),
  ]);

  const avgPosition = avgPos._avg.lastPosition;
  const avgAuditScore = auditAgg._avg.score;

  // Agregasi posisi rata-rata per hari untuk grafik tren.
  const byDay = new Map<string, { total: number; count: number }>();
  for (const snap of snapshots) {
    if (snap.position == null) continue;
    const day = snap.capturedAt.toISOString().slice(0, 10);
    const cur = byDay.get(day) ?? { total: 0, count: 0 };
    cur.total += snap.position;
    cur.count += 1;
    byDay.set(day, cur);
  }
  const trendPoints = [...byDay.entries()]
    .map(([date, { total, count }]) => ({
      date,
      avgPosition: Math.round((total / count) * 10) / 10,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const features = [
    { href: "/seo/keyword-research", icon: Search, title: "Keyword Research & Clustering", desc: "Riset keyword Indonesia (volume, difficulty, CPC, intent) lalu kelompokkan per intent & tema." },
    { href: "/seo/rank-tracker", icon: LineChart, title: "SERP Rank Tracker", desc: "Pantau posisi keyword di Google ID secara terjadwal, lihat tren, dan dapat notifikasi perubahan." },
    { href: "/seo/onpage-audit", icon: ListChecks, title: "On-Page SEO Audit", desc: "Audit satu URL: title, meta, heading, alt, schema, readability → skor + rekomendasi actionable." },
    { href: "/seo/crawler", icon: Bug, title: "Technical SEO Crawler", desc: "Crawl domain: broken link, redirect, duplicate/missing meta, sitemap/robots, dan Core Web Vitals." },
    { href: "/seo/content", icon: PenLine, title: "Content SEO Optimizer", desc: "Keyword → brief/outline → draft (LLM) → analisis keyword usage, readability, struktur + skor." },
    { href: "/seo/marketplace", icon: Store, title: "Marketplace SEO", desc: "Analisis listing teratas (judul, harga, terjual, rating) + skor optimasi judul produk sendiri." },
    { href: "/seo/reports", icon: FileText, title: "SEO Reports", desc: "Agregasi ranking & audit teknis → laporan yang bisa diekspor PDF/DOCX." },
  ];

  return (
    <SeoModulePage
      icon={Gauge}
      title="SEO Dashboard"
      description="Ringkasan modul SEO — melengkapi Research Hub. Default pasar Indonesia (Google.co.id)."
    >
      <ResearchHubSection title="Metrik" description="Kondisi SEO terkini.">
        <div className="flex flex-wrap gap-3">
          <ResearchHubStatChip label="Total keyword" value={keywordCount} tone="primary" />
          <ResearchHubStatChip label="Keyword dilacak" value={trackedCount} />
          <ResearchHubStatChip
            label="Posisi rata-rata"
            value={avgPosition != null ? formatRankPosition(Math.round(avgPosition)) : "—"}
            tone="success"
          />
          <ResearchHubStatChip label="Isu teknis" value={technicalIssues} tone="warning" />
          <ResearchHubStatChip
            label="Skor audit rata-rata"
            value={avgAuditScore != null ? Math.round(avgAuditScore) : "—"}
          />
        </div>
      </ResearchHubSection>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <ResearchHubSection title="Tren ranking" description="Posisi rata-rata 30 hari terakhir.">
          {trendPoints.length >= 2 ? (
            <div className={hub.panel}>
              <SeoRankTrendChart points={trendPoints} />
            </div>
          ) : (
            <div className={cn(hub.nestedPanel, "text-muted-foreground text-sm")}>
              Belum cukup data tren. Jalankan rank tracker beberapa hari untuk
              melihat grafik.
            </div>
          )}
        </ResearchHubSection>

        <ResearchHubSection title="Audit terbaru" description="Skor On-Page terakhir.">
          {recentAudits.length === 0 ? (
            <div className={cn(hub.nestedPanel, "text-muted-foreground text-sm")}>
              Belum ada audit.
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {recentAudits.map((a) => (
                <Link
                  key={a.id}
                  href={`/seo/onpage-audit/${a.id}`}
                  className={cn(hub.card, "flex items-center gap-3 p-2.5")}
                >
                  <span
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-lg border text-sm font-bold tabular-nums",
                      scoreToneClass(a.score),
                    )}
                  >
                    {a.score ?? "—"}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-xs">{a.url}</span>
                </Link>
              ))}
            </div>
          )}
        </ResearchHubSection>
      </div>

      <ResearchHubSection title="Fitur" description="Pilih alat untuk mulai.">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <Link
              key={f.href}
              href={f.href}
              className={cn(hub.card, hub.cardHover, "block p-5")}
            >
              <span className="bg-primary/10 text-primary mb-3 flex size-10 items-center justify-center rounded-xl border border-primary/25">
                <f.icon className="size-5" aria-hidden />
              </span>
              <p className="text-foreground font-semibold">{f.title}</p>
              <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                {f.desc}
              </p>
            </Link>
          ))}
        </div>
      </ResearchHubSection>
    </SeoModulePage>
  );
}
