import Link from "next/link";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Bot,
  Bug,
  FileText,
  Gauge,
  Globe,
  Lightbulb,
  LineChart,
  ListChecks,
  PenLine,
  Search,
  Store,
  Swords,
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
import { getSeoDashboardData } from "@/lib/seo/dashboard/overview";

/** Batas waktu grafik tren dashboard (30 hari terakhir). */
function dashboardCutoff(): Date {
  return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
}

export default async function SeoOverviewPage() {
  const [data, snapshots, recentAudits] = await Promise.all([
    getSeoDashboardData(),
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

  const {
    keywordCount,
    trackedCount,
    avgPosition,
    visibility,
    technicalIssues,
    latestHealthScore,
    avgAuditScore,
    contentPipeline,
    movers,
    spend,
    gsc,
  } = data;

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
    { href: "/seo/content/opportunities", icon: Lightbulb, title: "Content Opportunities", desc: "Rekomendasi artikel dari AI yang membaca riset keyword & posisi ranking Anda — pipeline ide → terbit." },
    { href: "/seo/keyword-research", icon: Search, title: "Keyword Research & Clustering", desc: "Riset keyword Indonesia (volume, difficulty, CPC, intent) lalu kelompokkan per intent & tema." },
    { href: "/seo/rank-tracker", icon: LineChart, title: "SERP Rank Tracker", desc: "Posisi harian + kompetitor, visibility score, share of voice, dan notifikasi perubahan." },
    { href: "/seo/domain-overview", icon: Globe, title: "Domain Overview", desc: "Potret organik domain apa pun: estimasi trafik, top keyword, dan kompetitor terdeteksi otomatis." },
    { href: "/seo/keyword-gap", icon: Swords, title: "Keyword Gap", desc: "Bandingkan keyword Anda vs kompetitor — temukan bucket missing/weak/untapped untuk digarap." },
    { href: "/seo/content-audit", icon: Activity, title: "Content Audit (GSC)", desc: "Data nyata Search Console: halaman yang trafiknya menurun & perlu refresh — langsung jadi opportunity." },
    { href: "/seo/ai-visibility", icon: Bot, title: "AI Visibility", desc: "Apakah brand Anda disebut ChatGPT/Gemini/Claude/Perplexity untuk keyword komersial? Frontier baru SEO (AEO)." },
    { href: "/seo/onpage-audit", icon: ListChecks, title: "On-Page SEO Audit", desc: "Audit satu URL: title, meta, heading, alt, schema, readability → skor + rekomendasi actionable." },
    { href: "/seo/crawler", icon: Bug, title: "Technical SEO Crawler", desc: "Crawl domain terjadwal: health score, diff isu antar-crawl, dan Core Web Vitals." },
    { href: "/seo/content", icon: PenLine, title: "Content SEO Optimizer", desc: "Brief grounded SERP → artikel AI 1500+ kata → skor real-time ala Surfer → ekspor DOCX/MD." },
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
          <ResearchHubStatChip
            label="Visibility"
            value={`${visibility}%`}
            tone="primary"
          />
          <ResearchHubStatChip
            label="Posisi rata-rata"
            value={avgPosition != null ? formatRankPosition(Math.round(avgPosition)) : "—"}
            tone="success"
          />
          <ResearchHubStatChip label="Total keyword" value={keywordCount} />
          <ResearchHubStatChip label="Keyword dilacak" value={trackedCount} />
          <ResearchHubStatChip
            label="Site health"
            value={latestHealthScore != null ? `${latestHealthScore}/100` : "—"}
          />
          <ResearchHubStatChip label="Isu teknis" value={technicalIssues} tone="warning" />
          <ResearchHubStatChip
            label="Skor audit rata-rata"
            value={avgAuditScore ?? "—"}
          />
        </div>
      </ResearchHubSection>

      {gsc?.configured ? (
        <div className={cn(hub.card, "p-4")}>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <div>
              <p className={cn(hub.label)}>Klik organik 28 hari (GSC)</p>
              <p className="text-2xl font-bold tabular-nums">
                {gsc.clicks28.toLocaleString("id-ID")}
                {gsc.prevClicks28 > 0 ? (
                  <span
                    className={cn(
                      "ml-2 text-sm font-medium",
                      gsc.clicks28 >= gsc.prevClicks28
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-red-600 dark:text-red-400",
                    )}
                  >
                    {gsc.clicks28 >= gsc.prevClicks28 ? "▲" : "▼"}{" "}
                    {Math.abs(
                      Math.round(
                        ((gsc.clicks28 - gsc.prevClicks28) / gsc.prevClicks28) * 100,
                      ),
                    )}
                    %
                  </span>
                ) : null}
              </p>
            </div>
            <div>
              <p className={cn(hub.label)}>Impresi 28 hari</p>
              <p className="text-2xl font-bold tabular-nums">
                {gsc.impressions28.toLocaleString("id-ID")}
              </p>
            </div>
            {gsc.topQueries.length > 0 ? (
              <div className="min-w-0 flex-1">
                <p className={cn(hub.label, "mb-1")}>Query teratas</p>
                <div className="flex flex-wrap gap-1.5">
                  {gsc.topQueries.map((q) => (
                    <span
                      key={q.key}
                      className={cn(hub.nestedPanel, "px-2 py-0.5 text-xs")}
                    >
                      {q.key}{" "}
                      <span className="text-muted-foreground tabular-nums">
                        {q.clicks}
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground text-xs">
                Data query terisi setelah cron GSC berjalan beberapa hari.
              </p>
            )}
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Pipeline konten */}
        <div className={cn(hub.card, "p-4")}>
          <p className={cn(hub.label, "mb-2")}>Pipeline konten</p>
          <div className="grid grid-cols-4 gap-2 text-center">
            {(
              [
                ["Ide", contentPipeline.ideas, "/seo/content/opportunities"],
                ["Brief", contentPipeline.briefs, "/seo/content"],
                ["Draft", contentPipeline.drafts, "/seo/content"],
                ["Terbit", contentPipeline.published, "/seo/content/opportunities"],
              ] as const
            ).map(([label, count, href]) => (
              <Link key={label} href={href} className={cn(hub.nestedPanel, "py-2")}>
                <p className="text-2xl font-bold tabular-nums">{count}</p>
                <p className="text-muted-foreground text-xs">{label}</p>
              </Link>
            ))}
          </div>
        </div>

        {/* Top movers */}
        <div className={cn(hub.card, "p-4")}>
          <p className={cn(hub.label, "mb-2")}>Top movers (vs cek sebelumnya)</p>
          {movers.up.length === 0 && movers.down.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Belum ada perubahan posisi tercatat.
            </p>
          ) : (
            <div className="flex flex-col gap-1 text-sm">
              {movers.up.slice(0, 3).map((m) => (
                <div key={`u-${m.keyword}`} className="flex items-center gap-2">
                  <ArrowUpRight className="size-3.5 shrink-0 text-emerald-500" />
                  <span className="min-w-0 flex-1 truncate">{m.keyword}</span>
                  <span className="text-emerald-600 shrink-0 text-xs tabular-nums dark:text-emerald-400">
                    +{m.delta}
                  </span>
                </div>
              ))}
              {movers.down.slice(0, 3).map((m) => (
                <div key={`d-${m.keyword}`} className="flex items-center gap-2">
                  <ArrowDownRight className="size-3.5 shrink-0 text-red-500" />
                  <span className="min-w-0 flex-1 truncate">{m.keyword}</span>
                  <span className="shrink-0 text-xs tabular-nums text-red-600 dark:text-red-400">
                    {m.delta}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Biaya API bulan ini */}
        <div className={cn(hub.card, "p-4")}>
          <p className={cn(hub.label, "mb-1")}>Biaya DataForSEO bulan ini</p>
          <p className="text-2xl font-bold tabular-nums">
            ${spend.total.toFixed(2)}
          </p>
          {spend.byModule.length > 0 ? (
            <div className="mt-2 flex flex-col gap-1.5">
              {spend.byModule.slice(0, 5).map((m) => {
                const max = spend.byModule[0]?.cost || 1;
                return (
                  <div key={m.module} className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground w-24 shrink-0 truncate">
                      {m.module}
                    </span>
                    <div className="bg-muted h-1.5 flex-1 overflow-hidden rounded-full">
                      <div
                        className="bg-primary h-full rounded-full"
                        style={{ width: `${(m.cost / max) * 100}%` }}
                      />
                    </div>
                    <span className="w-14 shrink-0 text-right tabular-nums">
                      ${m.cost.toFixed(2)}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-muted-foreground mt-1 text-xs">
              Belum ada panggilan API tercatat bulan ini.
            </p>
          )}
        </div>
      </div>

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
