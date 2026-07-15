import Link from "next/link";
import {
  ArrowRight,
  Bell,
  FileText,
  Inbox,
  TrendingUp,
} from "lucide-react";
import type {
  DashboardData,
  DataHealthLevel,
  ModuleHealth,
} from "@/lib/research/dashboard/get-dashboard-data";
import { ActionCenterList } from "@/components/research-hub/action-plan-panel";
import { RESEARCH_HUB_ZONES } from "@/components/research-hub/research-hub-module-nav";
import { LabPageShell, lab } from "@/components/lab/lab-primitives";
import { formatRelativeTime } from "@/lib/research/labels";
import { cn } from "@/lib/utils";

type DashboardRecommendation = DashboardData["recommendations"][number];
type DashboardAlertSeverity = "info" | "warning" | "critical";

const MODULE_DESCRIPTIONS: Record<string, string> = {
  "product-discovery":
    "Tarik produk kompetitor by keyword dari berbagai brand.",
  "keyword-intel": "Keyword marketplace & Google untuk naming.",
  "review-intelligence":
    "Sentimen, keluhan & pujian dari review kompetitor.",
  "competitor-tracker": "Harga, SKU, rating, dan promo kompetitor.",
  "social-listening": "Percakapan organik di sosial media.",
  "trend-radar": "Deteksi tren bahan, klaim, dan kategori.",
  "usp-analyzer": "Celah pasar & formulasi USP berbasis data.",
  "concept-lab": "Bangun & validasi konsep siap brief R&D.",
  "research-reports": "Laporan riset terdokumentasi & shareable.",
};

const HEALTH_META: Record<
  DataHealthLevel,
  { label: string; text: string; dot: string }
> = {
  live: {
    label: "Live",
    text: "text-emerald-600 dark:text-emerald-400",
    dot: "bg-emerald-500",
  },
  partial: {
    label: "Parsial",
    text: "text-amber-600 dark:text-amber-400",
    dot: "bg-amber-500",
  },
  demo: {
    label: "Demo",
    text: "text-orange-600 dark:text-orange-400",
    dot: "bg-orange-500",
  },
  idle: {
    label: "Kosong",
    text: "text-muted-foreground/70",
    dot: "bg-muted-foreground/40",
  },
};

const WORKFLOW = [
  {
    step: "01",
    title: "Discover",
    desc: "Product Discovery, Keyword Intel — kumpulkan sinyal pasar.",
  },
  {
    step: "02",
    title: "Analyze",
    desc: "Review, kompetitor, social, trend — sintesis intelligence.",
  },
  {
    step: "03",
    title: "Decide",
    desc: "USP, konsep produk, laporan — output siap brief.",
  },
] as const;

function severityTone(severity: DashboardAlertSeverity): string {
  switch (severity) {
    case "critical":
      return "text-rose-600 dark:text-rose-400";
    case "warning":
      return "text-amber-600 dark:text-amber-400";
    default:
      return "text-sky-600 dark:text-sky-400";
  }
}

function asActionCenterItems(recs: DashboardRecommendation[]) {
  return recs.map((r) => ({
    id: r.id,
    owner: r.owner as never,
    priority: r.priority as never,
    action: r.action,
    module: r.module,
    href: r.href,
    sourceLabel: r.sourceLabel,
  }));
}

function HealthBadge({ level }: { level: DataHealthLevel }) {
  const meta = HEALTH_META[level];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide",
        meta.text,
      )}
    >
      <span className={cn("size-1.5 rounded-full", meta.dot)} aria-hidden />
      {meta.label}
    </span>
  );
}

function ModuleGrid({
  items,
  healthByKey,
}: {
  items: (typeof RESEARCH_HUB_ZONES)[number]["items"];
  healthByKey: Map<string, ModuleHealth>;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {items.map((mod) => {
        const h = healthByKey.get(mod.key);
        const level = h?.level ?? "idle";
        const Icon = mod.icon;
        return (
          <Link
            key={mod.key}
            href={mod.href}
            className="bento-tile group justify-start gap-1.5"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2">
                <Icon
                  className="text-muted-foreground group-hover:text-primary size-3.5 shrink-0 transition-colors"
                  aria-hidden
                />
                <span className="truncate text-[13px] font-semibold">
                  {mod.label}
                </span>
              </span>
              <HealthBadge level={level} />
            </div>
            <p className="text-muted-foreground text-xs leading-relaxed">
              {MODULE_DESCRIPTIONS[mod.key] ?? ""}
            </p>
            {h?.detail ? (
              <p className="text-muted-foreground/70 text-[11px] tabular-nums">
                {h.detail}
              </p>
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}

function DataHealthPanel({
  healthByKey,
  latestReport,
}: {
  healthByKey: Map<string, ModuleHealth>;
  latestReport: DashboardData["latestReport"];
}) {
  const allModules = RESEARCH_HUB_ZONES.flatMap((z) => z.items);

  return (
    <aside className="flex flex-col gap-3 lg:sticky lg:top-20">
      <div className="bento-tile justify-start p-3.5">
        <h2 className="bento-label mb-2.5 block">Kesehatan data</h2>
        <ul className="divide-border/70 divide-y">
          {allModules.map((mod) => {
            const h = healthByKey.get(mod.key);
            return (
              <li key={mod.key}>
                <Link
                  href={mod.href}
                  className="hover:bg-muted/50 -mx-1.5 flex items-center justify-between gap-2 rounded-md px-1.5 py-1.5 transition-colors"
                  title={h?.detail}
                >
                  <span className="text-foreground truncate text-[13px]">
                    {mod.label}
                  </span>
                  <HealthBadge level={h?.level ?? "idle"} />
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      {latestReport ? (
        <Link
          href={`/research-hub/research-reports/${latestReport.id}`}
          className="bento-tile hover:border-primary/40 flex-row items-center gap-3 p-3.5"
        >
          <FileText className="text-primary size-4 shrink-0" aria-hidden />
          <div className="min-w-0">
            <p className="bento-label">Laporan terbaru</p>
            <p className="text-foreground truncate text-[13px] font-medium">
              {latestReport.title}
            </p>
          </div>
          <ArrowRight
            className="text-muted-foreground ml-auto size-3.5 shrink-0"
            aria-hidden
          />
        </Link>
      ) : null}
    </aside>
  );
}

export function ResearchCommandCenter({ data }: { data: DashboardData }) {
  const { kpis, alerts, health, latestReport, recommendations, cronHealth } =
    data;
  const staleCrons = cronHealth.filter((c) => c.isStale);
  const healthByKey = new Map<string, ModuleHealth>(
    health.map((h) => [h.key, h]),
  );

  const statusText =
    kpis.unreadAlerts > 0
      ? "text-amber-600 dark:text-amber-400"
      : kpis.reviewInProgress > 0
        ? "text-primary"
        : "text-emerald-600 dark:text-emerald-400";

  const statusValue =
    kpis.unreadAlerts > 0
      ? `${kpis.unreadAlerts} alert`
      : kpis.reviewInProgress > 0
        ? `${kpis.reviewInProgress} job`
        : "Stabil";

  const kpiCells = [
    { label: "Status", value: statusValue, valueClass: statusText },
    { label: "Review siap", value: kpis.reviewReady },
    { label: "Kompetitor aktif", value: kpis.competitorsActive },
    { label: "Tren emerging", value: kpis.emergingTrends },
    {
      label: "Konsep",
      value: `${kpis.conceptDrafts} draft / ${kpis.conceptReady} siap`,
    },
  ] as const;

  return (
    <LabPageShell className="gap-6">
      {/* Header bento: display besar, tanpa chip/gradient. */}
      <header className={cn(lab.entrance, "space-y-1.5")}>
        <h1 className="text-foreground text-3xl font-extrabold tracking-tight sm:text-4xl">
          Research <span className="text-primary">Hub</span>
        </h1>
        <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed sm:text-[15px]">
          Riset pasar dalam satu tempat — review, kompetitor, tren, social
          listening, USP, konsep produk, hingga laporan.
        </p>
      </header>

      {/* Papan bento metrik */}
      <div
        className={cn(
          lab.entrance,
          "grid grid-flow-row-dense auto-rows-[6.75rem] grid-cols-2 gap-3 md:grid-cols-4",
        )}
      >
        {/* Status — tile hero violet, dua baris */}
        <div className="bento-tile row-span-2 border-transparent bg-violet-600 shadow-md shadow-violet-600/20 dark:bg-violet-500">
          <span className="text-[11.5px] font-semibold text-violet-100 dark:text-violet-950/70">
            Status riset
          </span>
          <span className="bento-value text-4xl text-white dark:text-violet-950">
            {statusValue}
          </span>
          <span className="text-xs font-medium leading-snug text-violet-100/90 dark:text-violet-900/80">
            {kpis.unreadAlerts > 0
              ? "ada sinyal yang perlu ditinjau — cek daftar di bawah"
              : kpis.reviewInProgress > 0
                ? "analisis sedang berjalan di background"
                : "semua modul sinkron, tidak ada alert tertunda"}
          </span>
        </div>

        {kpiCells
          .filter((cell) => cell.label !== "Status")
          .map((cell) => (
            <div key={cell.label} className="bento-tile">
              <span className="bento-label">{cell.label}</span>
              <span className="bento-value text-2xl">{cell.value}</span>
            </div>
          ))}

        <div className="bento-tile border-transparent bg-[#e9e3f9] dark:bg-violet-400/10">
          <span className="text-[11.5px] font-semibold text-violet-700/70 dark:text-violet-300/70">
            Alert belum dibaca
          </span>
          <span className="bento-value text-2xl text-violet-950 dark:text-violet-200">
            {kpis.unreadAlerts}
          </span>
        </div>
        <div className="bento-tile border-transparent bg-[#ffedcd] dark:bg-amber-400/10">
          <span className="text-[11.5px] font-semibold text-amber-800/70 dark:text-amber-200/60">
            Job berjalan
          </span>
          <span className="bento-value text-2xl text-amber-900 dark:text-amber-300">
            {kpis.reviewInProgress}
          </span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_minmax(240px,280px)]">
        <div className="flex flex-col gap-6">
          {/* Alur riset */}
          <section className="bento-tile justify-start p-4">
            <p className="bento-label">Alur riset</p>
            <div className="divide-border/70 mt-3 grid gap-4 sm:grid-cols-3 sm:gap-0 sm:divide-x">
              {WORKFLOW.map((w) => (
                <div key={w.step} className="sm:px-4 sm:first:pl-0 sm:last:pr-0">
                  <p className="text-primary text-xs font-bold tabular-nums">
                    {w.step}
                  </p>
                  <p className="mt-1 text-[13px] font-semibold">{w.title}</p>
                  <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
                    {w.desc}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Action Center */}
          <section className="bento-tile justify-start p-4">
            <header className="mb-3">
              <h2 className="text-[13px] font-semibold">
                Action Center
                <span className="text-primary ml-2 text-[11px] font-medium">
                  rekomendasi lintas-modul
                </span>
              </h2>
            </header>
            <ActionCenterList
              recommendations={asActionCenterItems(recommendations)}
            />
          </section>

          {staleCrons.length > 0 ? (
            <div className="rounded-lg border border-amber-500/50 bg-amber-500/5 px-4 py-3">
              <p className="text-[13px] font-medium text-amber-900 dark:text-amber-200">
                Refresh terjadwal tidak berjalan — data bisa jadi basi
              </p>
              <ul className="mt-1.5 space-y-0.5 text-xs text-amber-800 dark:text-amber-300">
                {staleCrons.map((c) => (
                  <li key={c.mode}>
                    {c.label} ({c.schedule}):{" "}
                    {c.lastRunAt
                      ? `terakhir ${formatRelativeTime(new Date(c.lastRunAt))}${c.lastStatus === "FAILED" ? " — GAGAL" : ""}`
                      : "belum pernah jalan"}
                  </li>
                ))}
              </ul>
              <p className="mt-1.5 text-[11px] text-amber-700 dark:text-amber-400">
                Pastikan cron eksternal (Railway) memanggil
                /api/cron/research-sync sesuai jadwal.
              </p>
            </div>
          ) : null}

          {/* Alert & sinyal */}
          <section>
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <p className="bento-label">Yang perlu perhatian</p>
              <p className="text-muted-foreground text-[11px]">
                Alert kompetitor & sinyal tren terbaru
              </p>
            </div>
            <div className="bento-tile justify-start gap-0 overflow-hidden p-0">
              {alerts.length === 0 ? (
                <div className="text-muted-foreground flex flex-col items-center gap-2 px-6 py-10 text-center">
                  <Inbox className="size-5" aria-hidden />
                  <p className="text-[13px] font-medium">
                    Belum ada alert atau sinyal tren
                  </p>
                  <p className="text-xs">
                    Tambah kompetitor atau generate digest tren untuk mulai.
                  </p>
                </div>
              ) : (
                <ul className="divide-border/70 divide-y">
                  {alerts.map((a) => (
                    <li key={`${a.kind}-${a.id}`}>
                      <Link
                        href={a.href}
                        className="hover:bg-muted/50 flex items-start gap-3 px-4 py-2.5 transition-colors"
                      >
                        <span
                          className={cn(
                            "mt-0.5 shrink-0",
                            severityTone(a.severity),
                          )}
                          aria-hidden
                        >
                          {a.kind === "trend" ? (
                            <TrendingUp className="size-4" />
                          ) : (
                            <Bell className="size-4" />
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="text-foreground block truncate text-[13px] font-medium">
                            {a.title}
                          </span>
                          <span className="text-muted-foreground block truncate text-xs">
                            {a.subtitle}
                          </span>
                        </span>
                        <span className="text-muted-foreground shrink-0 text-[11px] tabular-nums">
                          {formatRelativeTime(new Date(a.createdAt))}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          {/* Zona modul */}
          {RESEARCH_HUB_ZONES.map((zone) => (
            <section key={zone.id}>
              <p className="bento-label mb-2 block">{zone.label}</p>
              <ModuleGrid items={zone.items} healthByKey={healthByKey} />
            </section>
          ))}
        </div>

        <DataHealthPanel
          healthByKey={healthByKey}
          latestReport={latestReport}
        />
      </div>
    </LabPageShell>
  );
}
