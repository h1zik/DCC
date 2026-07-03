import Link from "next/link";
import {
  ArrowRight,
  Bell,
  FileText,
  Inbox,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import type {
  DashboardData,
  DataHealthLevel,
  ModuleHealth,
} from "@/lib/research/dashboard/get-dashboard-data";
import { ActionCenterList } from "@/components/research-hub/action-plan-panel";
import { RESEARCH_HUB_ZONES } from "@/components/research-hub/research-hub-module-nav";
import {
  ResearchHubEmptyState,
  ResearchHubPageHeader,
  ResearchHubPageShell,
  ResearchHubSection,
  ResearchHubStatChip,
  hub,
} from "@/components/research-hub/research-hub-primitives";
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
  { label: string; tone: string; dot: string }
> = {
  live: {
    label: "Live",
    tone: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
  partial: {
    label: "Parsial",
    tone: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  demo: {
    label: "Demo",
    tone: "bg-orange-500/15 text-orange-700 dark:text-orange-300",
    dot: "bg-orange-500",
  },
  idle: {
    label: "Kosong",
    tone: "bg-muted text-muted-foreground",
    dot: "bg-muted-foreground/50",
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
        "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
        meta.tone,
      )}
    >
      {meta.label}
    </span>
  );
}

function ModuleBento({
  zoneId,
  items,
  healthByKey,
  delayBase,
}: {
  zoneId: string;
  items: (typeof RESEARCH_HUB_ZONES)[number]["items"];
  healthByKey: Map<string, ModuleHealth>;
  delayBase: number;
}) {
  const accent =
    zoneId === "discover"
      ? "border-l-primary/50"
      : zoneId === "intelligence"
        ? "border-l-sky-500/40"
        : "border-l-violet-500/40";

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {items.map((mod, i) => {
        const h = healthByKey.get(mod.key);
        const level = h?.level ?? "idle";
        const Icon = mod.icon;
        return (
          <Link
            key={mod.key}
            href={mod.href}
            style={{ animationDelay: `${delayBase + i * 50}ms` }}
            className={cn(
              hub.card,
              hub.cardHover,
              hub.entrance,
              "group flex flex-col gap-3 border-l-[3px] p-5",
              accent,
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <span className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-xl transition-transform duration-200 ease-out motion-reduce:transition-none group-hover:scale-105">
                <Icon className="size-5" aria-hidden />
              </span>
              <HealthBadge level={level} />
            </div>
            <div>
              <p className="group-hover:text-primary text-sm font-semibold transition-colors">
                {mod.label}
              </p>
              <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                {MODULE_DESCRIPTIONS[mod.key] ?? ""}
              </p>
              {h?.detail ? (
                <p className="text-muted-foreground/80 mt-1.5 text-[11px]">
                  {h.detail}
                </p>
              ) : null}
            </div>
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
    <aside className="flex flex-col gap-4 lg:sticky lg:top-20">
      <div className={cn(hub.panel)}>
        <h2 className="text-foreground mb-3 flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="text-primary size-4" aria-hidden />
          Kesehatan data
        </h2>
        <ul className="space-y-1">
          {allModules.map((mod) => {
            const h = healthByKey.get(mod.key);
            const meta = HEALTH_META[h?.level ?? "idle"];
            return (
              <li key={mod.key}>
                <Link
                  href={mod.href}
                  className="hover:bg-muted/50 flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 transition-colors"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      className={cn(
                        "size-2 shrink-0 rounded-full",
                        meta.dot,
                        (h?.level === "live" || h?.level === "partial") &&
                          "animate-pulse motion-reduce:animate-none",
                      )}
                      aria-hidden
                    />
                    <span className="text-foreground truncate text-sm">
                      {mod.label}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                      meta.tone,
                    )}
                    title={h?.detail}
                  >
                    {meta.label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      {latestReport ? (
        <Link
          href={`/research-hub/research-reports/${latestReport.id}`}
          className={cn(
            hub.card,
            hub.cardHover,
            "flex items-center gap-3 p-4",
          )}
        >
          <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
            <FileText className="size-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-muted-foreground text-[10px] font-medium uppercase tracking-wide">
              Laporan terbaru
            </p>
            <p className="text-foreground truncate text-sm font-medium">
              {latestReport.title}
            </p>
          </div>
          <ArrowRight className="text-muted-foreground size-4 shrink-0" />
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

  const statusTone =
    kpis.unreadAlerts > 0
      ? "warning"
      : kpis.reviewInProgress > 0
        ? "primary"
        : "success";

  const statusValue =
    kpis.unreadAlerts > 0
      ? `${kpis.unreadAlerts} alert`
      : kpis.reviewInProgress > 0
        ? `${kpis.reviewInProgress} job`
        : "Stabil";

  return (
    <ResearchHubPageShell>
      <ResearchHubPageHeader
        eyebrow="Command Center"
        title="Research Hub"
        description="Command center riset pasar — review, kompetitor, tren, social listening, USP, konsep produk, hingga laporan dalam satu tempat."
        footer={
          <div className="flex flex-wrap items-center gap-2">
            <ResearchHubStatChip
              label="Status"
              value={statusValue}
              tone={statusTone}
            />
            <ResearchHubStatChip
              label="Review siap"
              value={kpis.reviewReady}
              tone="success"
            />
            <ResearchHubStatChip
              label="Kompetitor aktif"
              value={kpis.competitorsActive}
            />
            <ResearchHubStatChip
              label="Tren emerging"
              value={kpis.emergingTrends}
            />
            <ResearchHubStatChip
              label="Konsep"
              value={`${kpis.conceptDrafts} draft / ${kpis.conceptReady} siap`}
            />
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_minmax(240px,280px)] lg:gap-8">
        <div className="flex flex-col gap-8">
          <section
            className={cn(hub.card, hub.cardBody, hub.entrance)}
            style={{ animationDelay: "80ms" }}
          >
            <p className={hub.label}>Alur riset</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              {WORKFLOW.map((w, i) => (
                <div
                  key={w.step}
                  className={cn(
                    "relative flex flex-col gap-2",
                    hub.entrance,
                  )}
                  style={{ animationDelay: `${100 + i * 100}ms` }}
                >
                  <span className="text-primary text-xs font-bold tabular-nums">
                    {w.step}
                  </span>
                  <p className="text-sm font-semibold">{w.title}</p>
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    {w.desc}
                  </p>
                  {i < WORKFLOW.length - 1 ? (
                    <ArrowRight
                      className="text-muted-foreground/40 absolute top-1 -right-2 hidden size-4 sm:block"
                      aria-hidden
                    />
                  ) : null}
                </div>
              ))}
            </div>
          </section>

          <section
            className={cn(
              "rounded-2xl border border-primary/20 bg-gradient-to-br from-card via-card to-primary/5 p-5 shadow-sm sm:p-6",
              hub.entrance,
            )}
            style={{ animationDelay: "160ms" }}
          >
            <header className="mb-4 flex flex-wrap items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="text-primary size-5" aria-hidden />
                <div>
                  <h2 className="text-base font-semibold">
                    Action Center
                  </h2>
                  <p className="text-muted-foreground text-xs">
                    Rekomendasi preskriptif lintas-modul — prioritas tertinggi
                  </p>
                </div>
              </div>
            </header>
            <ActionCenterList
              recommendations={asActionCenterItems(recommendations)}
            />
          </section>

          {staleCrons.length > 0 ? (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3">
              <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
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

          <ResearchHubSection
            title="Yang perlu perhatian"
            description="Alert kompetitor & sinyal tren terbaru"
            delayMs={240}
          >
            <div className={cn(hub.card, hub.cardBody)}>
              {alerts.length === 0 ? (
                <ResearchHubEmptyState
                  icon={Inbox}
                  title="Belum ada alert atau sinyal tren"
                  description="Tambah kompetitor atau generate digest tren untuk mulai."
                />
              ) : (
                <ul className="divide-border/60 -my-1 divide-y">
                  {alerts.map((a) => (
                    <li key={`${a.kind}-${a.id}`}>
                      <Link
                        href={a.href}
                        className="hover:bg-muted/50 -mx-2 flex items-start gap-3 rounded-lg px-2 py-2.5 transition-[colors,transform] duration-200 ease-out motion-reduce:transition-none hover:translate-x-0.5 motion-reduce:hover:translate-x-0"
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
                          <span className="text-foreground block truncate text-sm font-medium">
                            {a.title}
                          </span>
                          <span className="text-muted-foreground block truncate text-xs">
                            {a.subtitle}
                          </span>
                        </span>
                        <span className="text-muted-foreground shrink-0 text-xs">
                          {formatRelativeTime(new Date(a.createdAt))}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </ResearchHubSection>

          {RESEARCH_HUB_ZONES.map((zone, zi) => (
            <ResearchHubSection
              key={zone.id}
              title={zone.label}
              delayMs={320 + zi * 80}
            >
              <ModuleBento
                zoneId={zone.id}
                items={zone.items}
                healthByKey={healthByKey}
                delayBase={zi * 50}
              />
            </ResearchHubSection>
          ))}
        </div>

        <DataHealthPanel
          healthByKey={healthByKey}
          latestReport={latestReport}
        />
      </div>
    </ResearchHubPageShell>
  );
}
