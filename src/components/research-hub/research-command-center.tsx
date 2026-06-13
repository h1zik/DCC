import Link from "next/link";
import {
  AlertTriangle,
  BarChart3,
  Bell,
  FileText,
  FlaskConical,
  Inbox,
  type LucideIcon,
  MessageSquare,
  Radar,
  Search,
  Sparkles,
  Star,
  Target,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  DashboardData,
  DataHealthLevel,
  ModuleHealth,
} from "@/lib/research/dashboard/get-dashboard-data";
import { formatRelativeTime } from "@/lib/research/labels";
import { cn } from "@/lib/utils";

type ModuleMeta = {
  key: string;
  href: string;
  title: string;
  desc: string;
  icon: LucideIcon;
};

const MODULES: ModuleMeta[] = [
  {
    key: "review-intelligence",
    href: "/research-hub/review-intelligence",
    title: "Review Intelligence",
    desc: "Sentimen, keluhan & pujian dari review kompetitor.",
    icon: Star,
  },
  {
    key: "competitor-tracker",
    href: "/research-hub/competitor-tracker",
    title: "Competitor Tracker",
    desc: "Harga, SKU, rating, dan promo kompetitor.",
    icon: Target,
  },
  {
    key: "trend-radar",
    href: "/research-hub/trend-radar",
    title: "Trend Radar",
    desc: "Deteksi tren bahan, klaim, dan kategori.",
    icon: Radar,
  },
  {
    key: "keyword-intel",
    href: "/research-hub/keyword-intel",
    title: "Keyword Intel",
    desc: "Keyword marketplace & Google untuk naming.",
    icon: Search,
  },
  {
    key: "social-listening",
    href: "/research-hub/social-listening",
    title: "Social Listening",
    desc: "Percakapan organik di sosial media.",
    icon: MessageSquare,
  },
  {
    key: "usp-analyzer",
    href: "/research-hub/usp-analyzer",
    title: "USP & Gap Analyzer",
    desc: "Celah pasar & formulasi USP berbasis data.",
    icon: BarChart3,
  },
  {
    key: "concept-lab",
    href: "/research-hub/concept-lab",
    title: "Product Concept Lab",
    desc: "Bangun & validasi konsep siap brief R&D.",
    icon: FlaskConical,
  },
  {
    key: "research-reports",
    href: "/research-hub/research-reports",
    title: "Research Reports",
    desc: "Laporan riset terdokumentasi & shareable.",
    icon: FileText,
  },
];

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

function Kpi({
  icon: Icon,
  label,
  value,
  hint,
  href,
  accent,
}: {
  icon: LucideIcon;
  label: string;
  value: number | string;
  hint?: string;
  href: string;
  accent?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "border-border bg-card hover:border-primary/40 group flex flex-col gap-1 rounded-xl border p-4 shadow-sm transition-shadow hover:shadow-md",
        accent && "border-amber-500/40",
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground text-xs font-medium">{label}</span>
        <Icon
          className={cn(
            "size-4",
            accent ? "text-amber-500" : "text-muted-foreground/70",
          )}
          aria-hidden
        />
      </div>
      <span className="text-foreground text-2xl font-semibold tracking-tight tabular-nums">
        {value}
      </span>
      {hint ? <span className="text-muted-foreground text-xs">{hint}</span> : null}
    </Link>
  );
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

type DashboardAlertSeverity = "info" | "warning" | "critical";

export function ResearchCommandCenter({ data }: { data: DashboardData }) {
  const { kpis, alerts, health, latestReport } = data;
  const healthByKey = new Map<string, ModuleHealth>(
    health.map((h) => [h.key, h]),
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          icon={Star}
          label="Sumber review siap"
          value={kpis.reviewReady}
          hint={
            kpis.reviewInProgress > 0
              ? `${kpis.reviewInProgress} sedang diproses`
              : kpis.reviewPartial > 0
                ? `${kpis.reviewPartial} data parsial`
                : "semua lengkap"
          }
          href="/research-hub/review-intelligence"
        />
        <Kpi
          icon={Bell}
          label="Alert kompetitor"
          value={kpis.unreadAlerts}
          hint={`${kpis.competitorsActive} kompetitor aktif`}
          href="/research-hub/competitor-tracker"
          accent={kpis.unreadAlerts > 0}
        />
        <Kpi
          icon={TrendingUp}
          label="Tren emerging"
          value={kpis.emergingTrends}
          hint="sinyal dini minggu ini"
          href="/research-hub/trend-radar"
        />
        <Kpi
          icon={FlaskConical}
          label="Konsep produk"
          value={`${kpis.conceptDrafts} / ${kpis.conceptReady}`}
          hint="draft / siap brief"
          href="/research-hub/concept-lab"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="size-4 text-amber-500" aria-hidden />
              Yang perlu perhatian
            </CardTitle>
            {latestReport ? (
              <Link
                href={`/research-hub/research-reports/${latestReport.id}`}
                className="text-primary inline-flex items-center gap-1 text-xs font-medium hover:underline"
              >
                <FileText className="size-3.5" aria-hidden />
                Laporan terbaru
              </Link>
            ) : null}
          </CardHeader>
          <CardContent>
            {alerts.length === 0 ? (
              <div className="text-muted-foreground flex flex-col items-center gap-2 py-8 text-center">
                <Inbox className="size-8 opacity-40" aria-hidden />
                <p className="text-sm">Belum ada alert atau sinyal tren.</p>
                <p className="text-xs">
                  Tambah kompetitor atau generate digest tren untuk mulai.
                </p>
              </div>
            ) : (
              <ul className="divide-border/60 -my-1 divide-y">
                {alerts.map((a) => (
                  <li key={`${a.kind}-${a.id}`}>
                    <Link
                      href={a.href}
                      className="hover:bg-muted/50 -mx-2 flex items-start gap-3 rounded-lg px-2 py-2.5 transition-colors"
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
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="size-4 text-primary" aria-hidden />
              Kesehatan data
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1.5">
              {MODULES.map((mod) => {
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
                          className={cn("size-2 shrink-0 rounded-full", meta.dot)}
                          aria-hidden
                        />
                        <span className="text-foreground truncate text-sm">
                          {mod.title}
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
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {MODULES.map((mod) => {
          const Icon = mod.icon;
          const h = healthByKey.get(mod.key);
          const meta = HEALTH_META[h?.level ?? "idle"];
          return (
            <Link key={mod.key} href={mod.href} className="block h-full">
              <Card className="hover:border-primary/40 h-full transition-shadow hover:shadow-md">
                <CardHeader className="gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className="border-primary/30 bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg border"
                      aria-hidden
                    >
                      <Icon className="size-4" />
                    </span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                        meta.tone,
                      )}
                    >
                      {meta.label}
                    </span>
                  </div>
                  <CardTitle className="text-base">{mod.title}</CardTitle>
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    {mod.desc}
                  </p>
                  {h?.detail ? (
                    <p className="text-muted-foreground/80 text-[11px]">
                      {h.detail}
                    </p>
                  ) : null}
                </CardHeader>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
