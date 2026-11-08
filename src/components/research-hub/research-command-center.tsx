import Link from "next/link";
import { ArrowRight, Bell, FileText, Inbox, TrendingUp } from "lucide-react";
import type {
  DashboardData,
  DataHealthLevel,
  ModuleHealth,
} from "@/lib/research/dashboard/get-dashboard-data";
import { ActionCenterList } from "@/components/research-hub/action-plan-panel";
import { ResearchHubModulePage } from "@/components/research-hub/research-hub-module-page";
import {
  RESEARCH_HUB_ZONES,
  type ResearchHubNavItem,
  type ResearchHubNavZone,
} from "@/components/research-hub/research-hub-module-nav";
import { ResearchPanelEmpty } from "@/components/research-hub/kit/research-states";
import { formatRelativeTime } from "@/lib/research/labels";
import { cn } from "@/lib/utils";

type DashboardRecommendation = DashboardData["recommendations"][number];
type DashboardAlertSeverity = "info" | "warning" | "critical";

const MODULE_DESCRIPTIONS: Record<string, string> = {
  "product-discovery": "Tarik produk kompetitor per keyword dari berbagai brand.",
  "keyword-intel": "Keyword marketplace dan Google untuk penamaan produk.",
  "review-intelligence": "Sentimen, keluhan, dan pujian dari review kompetitor.",
  "competitor-tracker-shops": "Pantau harga, SKU, rating, dan promo toko kompetitor.",
  "competitor-tracker-products": "Bandingkan produk kompetitor per kategori.",
  "social-listening": "Percakapan organik di media sosial.",
  "trend-radar": "Deteksi tren bahan, klaim, dan kategori.",
  "usp-analyzer": "Celah pasar dan formulasi USP berbasis data.",
  "concept-lab": "Bangun dan validasi konsep siap brief R&D.",
  "product-innovation": "Ubah temuan riset jadi ide inovasi produk.",
  "research-reports": "Laporan riset yang terdokumentasi dan bisa dibagikan.",
};

const HEALTH_META: Record<
  DataHealthLevel,
  { label: string; text: string; dot: string }
> = {
  live: {
    label: "Live",
    text: "text-emerald-700 dark:text-emerald-400",
    dot: "bg-emerald-500",
  },
  partial: {
    label: "Parsial",
    text: "text-amber-700 dark:text-amber-400",
    dot: "bg-amber-500",
  },
  demo: {
    label: "Demo",
    text: "text-orange-700 dark:text-orange-400",
    dot: "bg-orange-500",
  },
  idle: {
    label: "Kosong",
    text: "text-muted-foreground",
    dot: "bg-muted-foreground/40",
  },
};

/** Kunci kesehatan data per modul nav (Competitor shops & products berbagi satu). */
function healthKeyFor(navKey: string): string {
  return navKey.startsWith("competitor-tracker") ? "competitor-tracker" : navKey;
}

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

const linkFocus =
  "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none";

function HealthBadge({ level }: { level: DataHealthLevel }) {
  const meta = HEALTH_META[level];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 text-xs font-medium",
        meta.text,
      )}
    >
      <span className={cn("rh-dot", meta.dot)} aria-hidden />
      {meta.label}
    </span>
  );
}

function ModuleRow({
  item,
  health,
}: {
  item: ResearchHubNavItem;
  health: ModuleHealth | undefined;
}) {
  const Icon = item.icon;
  return (
    <li>
      <Link
        href={item.href}
        className={cn(
          "hover:bg-muted/50 group flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors",
          linkFocus,
        )}
      >
        <Icon
          className="text-muted-foreground group-hover:text-primary mt-0.5 size-4 shrink-0 transition-colors"
          aria-hidden
        />
        <span className="min-w-0 flex-1">
          <span className="text-foreground block text-sm font-medium">
            {item.label}
          </span>
          <span className="rh-meta block">
            {MODULE_DESCRIPTIONS[item.key] ?? ""}
          </span>
        </span>
        {health ? (
          <span className="flex shrink-0 flex-col items-end gap-0.5 text-right">
            <HealthBadge level={health.level} />
            {health.detail ? (
              <span className="rh-meta rh-num hidden max-w-[16rem] truncate sm:block">
                {health.detail}
              </span>
            ) : null}
          </span>
        ) : null}
      </Link>
    </li>
  );
}

function WorkflowStep({
  zone,
  healthByKey,
}: {
  zone: ResearchHubNavZone;
  healthByKey: Map<string, ModuleHealth>;
}) {
  const headingId = `rh-step-${zone.id}`;
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      <div className="flex items-start gap-3">
        <span
          className="rh-step-dot mt-0.5 shrink-0"
          aria-label={`Tahap ${zone.step} dari ${RESEARCH_HUB_ZONES.length}`}
        >
          {zone.step}
        </span>
        <div className="min-w-0">
          <h2 id={headingId} className="rh-section-title">
            {zone.label}
          </h2>
          <p className="rh-meta">{zone.summary}</p>
        </div>
      </div>
      <ul className="border-border/70 ml-2.5 flex flex-col border-l pl-3">
        {zone.items.map((item) => (
          <ModuleRow
            key={item.key}
            item={item}
            health={healthByKey.get(healthKeyFor(item.key))}
          />
        ))}
      </ul>
    </section>
  );
}

function SummaryRow({ kpis }: { kpis: DashboardData["kpis"] }) {
  const status =
    kpis.unreadAlerts > 0
      ? {
          value: `${kpis.unreadAlerts} alert`,
          note: "Ada sinyal yang perlu ditinjau.",
          className: "text-amber-700 dark:text-amber-400",
        }
      : kpis.reviewInProgress > 0
        ? {
            value: `${kpis.reviewInProgress} job berjalan`,
            note: "Analisis sedang berjalan di background.",
            className: "text-foreground",
          }
        : {
            value: "Stabil",
            note: "Tidak ada alert tertunda.",
            className: "text-emerald-700 dark:text-emerald-400",
          };

  const cells: { label: string; value: number }[] = [
    { label: "Review siap", value: kpis.reviewReady },
    { label: "Kompetitor aktif", value: kpis.competitorsActive },
    { label: "Tren emerging", value: kpis.emergingTrends },
    { label: "Konsep draft", value: kpis.conceptDrafts },
    { label: "Konsep siap", value: kpis.conceptReady },
    { label: "Alert belum dibaca", value: kpis.unreadAlerts },
    { label: "Job berjalan", value: kpis.reviewInProgress },
  ];

  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4 xl:grid-cols-8">
      <div className="col-span-2 flex flex-col gap-0.5 sm:col-span-4 xl:col-span-1">
        <dt className="rh-meta">Status riset</dt>
        <dd
          className={cn("text-lg font-semibold", status.className)}
          aria-live="polite"
        >
          {status.value}
        </dd>
        <dd className="rh-meta">{status.note}</dd>
      </div>
      {cells.map((cell) => (
        <div key={cell.label} className="flex flex-col gap-0.5">
          <dt className="rh-meta">{cell.label}</dt>
          <dd className="rh-num text-foreground text-lg font-semibold">
            {cell.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function StaleCronNotice({
  staleCrons,
}: {
  staleCrons: DashboardData["cronHealth"];
}) {
  if (staleCrons.length === 0) return null;
  return (
    <div
      role="status"
      className="rounded-lg border border-amber-500/50 bg-amber-500/5 px-4 py-3"
    >
      <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
        Refresh terjadwal tidak berjalan, data bisa jadi basi
      </p>
      <ul className="mt-1.5 space-y-0.5 text-xs text-amber-800 dark:text-amber-300">
        {staleCrons.map((c) => (
          <li key={c.mode}>
            {c.label} ({c.schedule}):{" "}
            {c.lastRunAt
              ? `terakhir jalan ${formatRelativeTime(new Date(c.lastRunAt))}${c.lastStatus === "FAILED" ? ", gagal" : ""}`
              : "belum pernah jalan"}
          </li>
        ))}
      </ul>
      <p className="mt-1.5 text-xs text-amber-800 dark:text-amber-400">
        Pastikan cron eksternal (Railway) memanggil /api/cron/research-sync
        sesuai jadwal.
      </p>
    </div>
  );
}

function AttentionSection({ alerts }: { alerts: DashboardData["alerts"] }) {
  return (
    <section aria-labelledby="rh-attention" className="flex flex-col gap-2">
      <div>
        <h2 id="rh-attention" className="rh-section-title">
          Perlu perhatian
        </h2>
        <p className="rh-meta">Alert kompetitor dan sinyal tren terbaru.</p>
      </div>
      {alerts.length === 0 ? (
        <ResearchPanelEmpty
          icon={Inbox}
          title="Belum ada alert atau sinyal tren"
          description="Alert muncul setelah kompetitor dipantau atau digest tren dibuat."
        />
      ) : (
        <ul className="divide-border/70 border-border/70 divide-y border-y">
          {alerts.map((a) => (
            <li key={`${a.kind}-${a.id}`}>
              <Link
                href={a.href}
                className={cn(
                  "hover:bg-muted/50 flex items-start gap-3 px-1 py-2.5 transition-colors",
                  linkFocus,
                )}
              >
                <span
                  className={cn("mt-0.5 shrink-0", severityTone(a.severity))}
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
                  <span className="rh-meta block truncate">{a.subtitle}</span>
                </span>
                <time
                  dateTime={a.createdAt}
                  className="rh-meta rh-num shrink-0"
                >
                  {formatRelativeTime(new Date(a.createdAt))}
                </time>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function LatestReportSection({
  latestReport,
}: {
  latestReport: DashboardData["latestReport"];
}) {
  return (
    <section aria-labelledby="rh-latest-report" className="flex flex-col gap-2">
      <h2 id="rh-latest-report" className="rh-section-title">
        Laporan terbaru
      </h2>
      {latestReport ? (
        <Link
          href={`/research-hub/research-reports/${latestReport.id}`}
          className={cn(
            "border-border hover:bg-muted/50 group flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors",
            linkFocus,
          )}
        >
          <FileText className="text-muted-foreground size-4 shrink-0" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="text-foreground block truncate text-sm font-medium">
              {latestReport.title}
            </span>
            <time dateTime={latestReport.createdAt} className="rh-meta block">
              Dibuat {formatRelativeTime(new Date(latestReport.createdAt))}
            </time>
          </span>
          <ArrowRight
            className="text-muted-foreground group-hover:text-foreground size-4 shrink-0 transition-colors"
            aria-hidden
          />
        </Link>
      ) : (
        <ResearchPanelEmpty
          icon={FileText}
          title="Belum ada laporan"
          description="Buat laporan di Research Reports untuk merangkum temuan riset."
          action={
            <Link
              href="/research-hub/research-reports"
              className={cn(
                "text-primary text-sm font-medium hover:underline",
                linkFocus,
              )}
            >
              Buka Research Reports
            </Link>
          }
        />
      )}
    </section>
  );
}

export function ResearchCommandCenter({ data }: { data: DashboardData }) {
  const { kpis, alerts, health, latestReport, recommendations, cronHealth } =
    data;
  const staleCrons = cronHealth.filter((c) => c.isStale);
  const healthByKey = new Map<string, ModuleHealth>(
    health.map((h) => [h.key, h]),
  );

  return (
    <ResearchHubModulePage
      title="Research Hub"
      description="Riset pasar dalam satu alur: temukan peluang, pahami pasar, lalu susun strategi produk."
      summary={<SummaryRow kpis={kpis} />}
    >
      <StaleCronNotice staleCrons={staleCrons} />

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
        <div className="flex flex-col gap-8">
          {RESEARCH_HUB_ZONES.map((zone) => (
            <WorkflowStep key={zone.id} zone={zone} healthByKey={healthByKey} />
          ))}
        </div>

        <aside className="flex flex-col gap-8">
          <AttentionSection alerts={alerts} />
          <LatestReportSection latestReport={latestReport} />
        </aside>
      </div>

      <section aria-labelledby="rh-actions" className="flex flex-col gap-2">
        <div>
          <h2 id="rh-actions" className="rh-section-title">
            Rekomendasi tindakan
          </h2>
          <p className="rh-meta">
            Rekomendasi lintas modul dari analisis terbaru.
          </p>
        </div>
        <ActionCenterList recommendations={asActionCenterItems(recommendations)} />
      </section>
    </ResearchHubModulePage>
  );
}
