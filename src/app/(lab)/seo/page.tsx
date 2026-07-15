import Link from "next/link";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Bot,
  Bug,
  FileText,
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
import { SeoRankTrendChart } from "@/components/seo/seo-rank-trend-chart";
import { LabPageShell, LabSection, lab } from "@/components/lab/lab-primitives";
import { cn } from "@/lib/utils";
import { formatRankPosition, scoreToneClass } from "@/lib/seo/labels";
import { getSeoDashboardData } from "@/lib/seo/dashboard/overview";

/** Batas waktu grafik tren dashboard (30 hari terakhir). */
function dashboardCutoff(): Date {
  return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
}

/** Kapsul ikon pastel untuk grid fitur (di-cycle berurutan). */
const FEATURE_CAPSULES = [
  "bg-teal-500/15 text-teal-700 dark:text-teal-300",
  "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  "bg-rose-500/15 text-rose-700 dark:text-rose-300",
] as const;

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

  const pipelineSteps = [
    ["Ide", contentPipeline.ideas, "/seo/content/opportunities"],
    ["Brief", contentPipeline.briefs, "/seo/content"],
    ["Draft", contentPipeline.drafts, "/seo/content"],
    ["Terbit", contentPipeline.published, "/seo/content/opportunities"],
  ] as const;

  return (
    <LabPageShell>
      {/* Header bento: display besar, tanpa chip/gradient. */}
      <header className={cn(lab.entrance, "space-y-1.5")}>
        <h1 className="text-foreground text-3xl font-extrabold tracking-tight sm:text-4xl">
          SEO <span className="text-primary">Toolkit</span>
        </h1>
        <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed sm:text-[15px]">
          Semua sinyal organik dalam satu papan — melengkapi Research Hub.
          Default pasar Indonesia (Google.co.id).
        </p>
      </header>

      {/* Papan bento metrik */}
      <div
        className={cn(
          lab.entrance,
          "grid grid-flow-row-dense auto-rows-[6.75rem] grid-cols-2 gap-3 md:grid-cols-4",
        )}
      >
        {/* Visibility — tile hero teal, dua baris */}
        <div className="bento-tile row-span-2 border-transparent bg-teal-600 shadow-md shadow-teal-600/20 dark:bg-teal-500">
          <span className="text-[11.5px] font-semibold text-teal-100 dark:text-teal-950/70">
            Visibility
          </span>
          <span className="bento-value text-5xl text-white dark:text-teal-950">
            {visibility}
            <span className="text-2xl font-bold text-teal-200/80 dark:text-teal-900/60">
              %
            </span>
          </span>
          <span className="text-xs font-medium leading-snug text-teal-100/90 dark:text-teal-900/80">
            dari {trackedCount} keyword yang dilacak di Google.co.id
          </span>
        </div>

        {/* Tren posisi 30 hari — tile lebar dua baris */}
        <div className="bento-tile col-span-2 row-span-2 justify-start">
          <div className="flex items-center justify-between">
            <span className="bento-label">Tren posisi · 30 hari</span>
            <Link
              href="/seo/rank-tracker"
              className="text-primary text-xs font-semibold hover:underline"
            >
              Rank tracker →
            </Link>
          </div>
          {trendPoints.length >= 2 ? (
            <SeoRankTrendChart points={trendPoints} height={168} />
          ) : (
            <p className="text-muted-foreground m-auto max-w-60 text-center text-sm">
              Belum cukup data tren. Jalankan rank tracker beberapa hari untuk
              melihat grafik.
            </p>
          )}
        </div>

        {/* Posisi rata-rata */}
        <div className="bento-tile">
          <span className="bento-label">Posisi rata-rata</span>
          <span className="bento-value">
            {avgPosition != null
              ? formatRankPosition(Math.round(avgPosition))
              : "—"}
          </span>
        </div>

        {/* Site health — amber pastel */}
        <div className="bento-tile border-transparent bg-[#ffedcd] dark:bg-amber-400/10">
          <span className="text-[11.5px] font-semibold text-amber-800/70 dark:text-amber-200/60">
            Site health
          </span>
          <span className="bento-value text-amber-900 dark:text-amber-300">
            {latestHealthScore != null ? latestHealthScore : "—"}
            {latestHealthScore != null ? (
              <span className="text-lg font-bold text-amber-800/50 dark:text-amber-300/50">
                /100
              </span>
            ) : null}
          </span>
        </div>

        {/* Isu teknis — rose pastel */}
        <div className="bento-tile border-transparent bg-[#fbdcd7] dark:bg-rose-400/10">
          <span className="text-[11.5px] font-semibold text-rose-800/70 dark:text-rose-200/60">
            Isu teknis
          </span>
          <span className="bento-value text-rose-900 dark:text-rose-300">
            {technicalIssues}
          </span>
        </div>

        {/* Keyword */}
        <div className="bento-tile">
          <span className="bento-label">Total keyword</span>
          <span className="bento-value">{keywordCount}</span>
        </div>
        <div className="bento-tile">
          <span className="bento-label">Keyword dilacak</span>
          <span className="bento-value">{trackedCount}</span>
        </div>

        {/* Skor audit on-page */}
        <div className="bento-tile">
          <span className="bento-label">Skor audit rata-rata</span>
          <span className="bento-value">
            {avgAuditScore ?? "—"}
            {avgAuditScore != null ? (
              <span className="text-muted-foreground/60 text-lg font-bold">
                /100
              </span>
            ) : null}
          </span>
        </div>

        {/* Pipeline konten — lavender, strip penuh */}
        <div className="bento-tile col-span-2 border-transparent bg-[#e9e3f9] md:col-span-4 md:flex-row md:items-center dark:bg-violet-400/10">
          <span className="text-[11.5px] font-semibold text-violet-700/70 md:w-28 md:shrink-0 dark:text-violet-300/70">
            Pipeline konten
          </span>
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1.5 text-violet-950 dark:text-violet-200">
            {pipelineSteps.map(([label, count, href], index) => (
              <span key={label} className="inline-flex items-center gap-2">
                <Link
                  href={href}
                  className="bg-card inline-flex items-baseline gap-1.5 rounded-full px-3.5 py-1.5 shadow-sm transition-transform hover:-translate-y-0.5 motion-reduce:hover:translate-y-0"
                >
                  <span className="text-sm font-extrabold tabular-nums">
                    {count}
                  </span>
                  <span className="text-muted-foreground text-xs font-medium">
                    {label}
                  </span>
                </Link>
                {index < pipelineSteps.length - 1 ? (
                  <span className="text-violet-400 dark:text-violet-500">→</span>
                ) : null}
              </span>
            ))}
          </div>
          <Link
            href="/seo/content"
            className="text-violet-700 hidden text-xs font-semibold hover:underline md:block dark:text-violet-300"
          >
            Content engine →
          </Link>
        </div>
      </div>

      {/* Search Console (bila terhubung) */}
      {gsc?.configured ? (
        <div className={cn(lab.entrance, "bento-tile")}>
          <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
            <div>
              <p className="bento-label">Klik organik 28 hari (GSC)</p>
              <p className="bento-value mt-1">
                {gsc.clicks28.toLocaleString("id-ID")}
                {gsc.prevClicks28 > 0 ? (
                  <span
                    className={cn(
                      "ml-2 text-sm font-semibold tracking-normal",
                      gsc.clicks28 >= gsc.prevClicks28
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-red-600 dark:text-red-400",
                    )}
                  >
                    {gsc.clicks28 >= gsc.prevClicks28 ? "▲" : "▼"}{" "}
                    {Math.abs(
                      Math.round(
                        ((gsc.clicks28 - gsc.prevClicks28) / gsc.prevClicks28) *
                          100,
                      ),
                    )}
                    %
                  </span>
                ) : null}
              </p>
            </div>
            <div>
              <p className="bento-label">Impresi 28 hari</p>
              <p className="bento-value mt-1">
                {gsc.impressions28.toLocaleString("id-ID")}
              </p>
            </div>
            {gsc.topQueries.length > 0 ? (
              <div className="min-w-0 flex-1">
                <p className="bento-label mb-1.5">Query teratas</p>
                <div className="flex flex-wrap gap-1.5">
                  {gsc.topQueries.map((q) => (
                    <span
                      key={q.key}
                      className="bg-muted/60 rounded-full px-2.5 py-1 text-xs"
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

      {/* Detail: movers, biaya, audit */}
      <div className={cn(lab.entrance, "grid gap-3 lg:grid-cols-3")}>
        <div className="bento-tile justify-start gap-3">
          <p className="bento-label">Top movers (vs cek sebelumnya)</p>
          {movers.up.length === 0 && movers.down.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Belum ada perubahan posisi tercatat.
            </p>
          ) : (
            <div className="flex flex-col gap-1.5 text-sm">
              {movers.up.slice(0, 3).map((m) => (
                <div key={`u-${m.keyword}`} className="flex items-center gap-2">
                  <ArrowUpRight className="size-3.5 shrink-0 text-emerald-500" />
                  <span className="min-w-0 flex-1 truncate">{m.keyword}</span>
                  <span className="shrink-0 text-xs font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                    +{m.delta}
                  </span>
                </div>
              ))}
              {movers.down.slice(0, 3).map((m) => (
                <div key={`d-${m.keyword}`} className="flex items-center gap-2">
                  <ArrowDownRight className="size-3.5 shrink-0 text-red-500" />
                  <span className="min-w-0 flex-1 truncate">{m.keyword}</span>
                  <span className="shrink-0 text-xs font-semibold tabular-nums text-red-600 dark:text-red-400">
                    {m.delta}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bento-tile justify-start gap-3">
          <div>
            <p className="bento-label">Biaya DataForSEO bulan ini</p>
            <p className="bento-value mt-1 text-2xl">${spend.total.toFixed(2)}</p>
          </div>
          {spend.byModule.length > 0 ? (
            <div className="flex flex-col gap-1.5">
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
            <p className="text-muted-foreground text-xs">
              Belum ada panggilan API tercatat bulan ini.
            </p>
          )}
        </div>

        <div className="bento-tile justify-start gap-3">
          <p className="bento-label">Audit terbaru</p>
          {recentAudits.length === 0 ? (
            <p className="text-muted-foreground text-sm">Belum ada audit.</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {recentAudits.map((a) => (
                <Link
                  key={a.id}
                  href={`/seo/onpage-audit/${a.id}`}
                  className="border-border/60 bg-muted/40 hover:bg-muted/70 flex items-center gap-3 rounded-xl border p-2 transition-colors"
                >
                  <span
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-lg border text-sm font-bold tabular-nums",
                      scoreToneClass(a.score),
                    )}
                  >
                    {a.score ?? "—"}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-xs">
                    {a.url}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      <LabSection title="Fitur" description="Pilih alat untuk mulai.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f, index) => (
            <Link
              key={f.href}
              href={f.href}
              className="bento-tile group justify-start gap-0"
            >
              <span className="mb-3 flex items-start justify-between">
                <span
                  className={cn(
                    "flex size-10 items-center justify-center rounded-xl",
                    FEATURE_CAPSULES[index % FEATURE_CAPSULES.length],
                  )}
                >
                  <f.icon className="size-5" aria-hidden />
                </span>
                <ArrowUpRight
                  className="text-muted-foreground/0 size-4 transition-all duration-200 group-hover:text-muted-foreground group-hover:-translate-y-0.5 group-hover:translate-x-0.5 motion-reduce:transition-none"
                  aria-hidden
                />
              </span>
              <p className="text-foreground font-bold tracking-tight">
                {f.title}
              </p>
              <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                {f.desc}
              </p>
            </Link>
          ))}
        </div>
      </LabSection>
    </LabPageShell>
  );
}
