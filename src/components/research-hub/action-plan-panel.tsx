"use client";

import { type ReactNode, useMemo } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Clock,
  Gauge,
  Lightbulb,
  Target,
  TrendingUp,
} from "lucide-react";
import {
  REC_OWNER_LABELS,
  recommendationScore,
  type ActionPlan,
  type RecOwner,
  type RecPriority,
  type Recommendation,
} from "@/lib/research/prescriptive/types";
import { asActionPlan } from "@/lib/research/prescriptive/parse";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const PRIORITY_STYLE: Record<RecPriority, string> = {
  P0: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30",
  P1: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
  P2: "bg-slate-500/10 text-slate-600 dark:text-slate-300 border-slate-500/30",
};

const OWNER_ACCENT: Record<RecOwner, string> = {
  MARKETING: "border-l-blue-500",
  RND: "border-l-violet-500",
  PRICING: "border-l-emerald-500",
  FINANCE: "border-l-amber-500",
  SUPPLY: "border-l-cyan-500",
  BRAND: "border-l-pink-500",
};

const EFFORT_LABEL: Record<string, string> = {
  LOW: "Effort rendah",
  MED: "Effort sedang",
  HIGH: "Effort tinggi",
};

const HORIZON_LABEL: Record<string, string> = {
  NOW: "Sekarang",
  "30D": "30 hari",
  QUARTER: "Kuartal ini",
};

export function ActionPlanPanel({
  plan,
  title = "Rencana Aksi",
  subtitle,
  emptyHint = "Belum ada rencana aksi. Jalankan analisis untuk menghasilkan rekomendasi.",
  renderFooter,
  className,
}: {
  /** Raw JSON (Prisma Json) or a typed ActionPlan. */
  plan: unknown;
  title?: string;
  subtitle?: string;
  emptyHint?: string;
  renderFooter?: (rec: Recommendation) => ReactNode;
  className?: string;
}) {
  const parsed: ActionPlan | null = useMemo(() => {
    if (
      plan &&
      typeof plan === "object" &&
      "recommendations" in (plan as Record<string, unknown>)
    ) {
      return asActionPlan(plan);
    }
    return asActionPlan(plan);
  }, [plan]);

  const sorted = useMemo(
    () =>
      parsed
        ? [...parsed.recommendations].sort(
            (a, b) => recommendationScore(b) - recommendationScore(a),
          )
        : [],
    [parsed],
  );

  return (
    <section
      className={cn(
        "rounded-xl border bg-gradient-to-br from-card to-muted/30 p-5 shadow-sm",
        className,
      )}
    >
      <header className="mb-4 flex items-start gap-3">
        <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Lightbulb className="size-5" aria-hidden />
        </div>
        <div className="min-w-0">
          <h3 className="text-base font-semibold">{title}</h3>
          {parsed?.headline ? (
            <p className="text-sm text-muted-foreground">{parsed.headline}</p>
          ) : subtitle ? (
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
      </header>

      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyHint}</p>
      ) : (
        <ol className="flex flex-col gap-3">
          {sorted.map((rec) => (
            <li
              key={rec.id}
              className={cn(
                "rounded-lg border border-l-4 bg-card p-4",
                OWNER_ACCENT[rec.owner],
              )}
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  className={cn("font-semibold", PRIORITY_STYLE[rec.priority])}
                >
                  {rec.priority}
                </Badge>
                <Badge variant="secondary">{REC_OWNER_LABELS[rec.owner]}</Badge>
                <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Gauge className="size-3.5" aria-hidden />
                  {Math.round(rec.confidence * 100)}% yakin
                </span>
              </div>

              <p className="mt-2 font-medium leading-snug">{rec.action}</p>
              {rec.rationale ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  {rec.rationale}
                </p>
              ) : null}

              <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {rec.expectedImpact ? (
                  <span className="inline-flex items-center gap-1">
                    <TrendingUp className="size-3.5" aria-hidden />
                    {rec.expectedImpact}
                  </span>
                ) : null}
                {rec.metricToWatch ? (
                  <span className="inline-flex items-center gap-1">
                    <Target className="size-3.5" aria-hidden />
                    {rec.metricToWatch}
                  </span>
                ) : null}
                <span className="inline-flex items-center gap-1">
                  <Clock className="size-3.5" aria-hidden />
                  {HORIZON_LABEL[rec.horizon] ?? rec.horizon} ·{" "}
                  {EFFORT_LABEL[rec.effort] ?? rec.effort}
                </span>
              </div>

              {rec.evidence.length > 0 ? (
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {rec.evidence.map((ev, i) => (
                    <span
                      key={`${rec.id}-ev-${i}`}
                      className="inline-flex max-w-full items-center gap-1 truncate rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
                      title={`${ev.module}: ${ev.label}`}
                    >
                      <ArrowUpRight className="size-3 shrink-0" aria-hidden />
                      <span className="truncate">{ev.label}</span>
                    </span>
                  ))}
                </div>
              ) : null}

              {renderFooter ? (
                <div className="mt-3 flex flex-wrap gap-2">{renderFooter(rec)}</div>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export type ActionCenterItem = {
  id: string;
  owner: RecOwner;
  priority: RecPriority;
  action: string;
  module: string;
  href?: string | null;
  sourceLabel?: string | null;
};

/** Compact owner-grouped list for the dashboard Action Center. */
export function ActionCenterList({
  recommendations,
}: {
  recommendations: ActionCenterItem[];
}) {
  if (recommendations.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Belum ada rekomendasi aktif. Jalankan analisis di modul mana pun untuk
        mengisi Action Center.
      </p>
    );
  }

  return (
    <ul className="flex flex-col divide-y">
      {recommendations.map((rec) => {
        const body = (
          <div
            className={cn(
              "flex items-start gap-3 py-3",
              OWNER_ACCENT[rec.owner],
            )}
          >
            <Badge
              variant="outline"
              className={cn(
                "mt-0.5 shrink-0 font-semibold",
                PRIORITY_STYLE[rec.priority],
              )}
            >
              {rec.priority}
            </Badge>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium leading-snug">{rec.action}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {REC_OWNER_LABELS[rec.owner]}
                {rec.sourceLabel ? ` · ${rec.sourceLabel}` : ""}
              </p>
            </div>
            {rec.href ? (
              <ArrowUpRight
                className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                aria-hidden
              />
            ) : null}
          </div>
        );

        return (
          <li key={rec.id}>
            {rec.href ? (
              <Link
                href={rec.href}
                className="block rounded-md transition-colors hover:bg-muted/50"
              >
                {body}
              </Link>
            ) : (
              body
            )}
          </li>
        );
      })}
    </ul>
  );
}
