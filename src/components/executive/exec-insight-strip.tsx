import Link from "next/link";
import { AlertTriangle, CheckCircle2, ChevronRight, Info, OctagonAlert } from "lucide-react";
import type { ExecInsight } from "@/lib/executive-dashboard";
import { cn } from "@/lib/utils";

const toneStyle: Record<ExecInsight["tone"], { box: string; icon: string }> = {
  danger: {
    box: "border-destructive/30 bg-destructive/5 hover:bg-destructive/10",
    icon: "bg-destructive/10 text-destructive",
  },
  warning: {
    box: "border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10",
    icon: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  },
  info: {
    box: "border-border bg-card hover:bg-muted/50",
    icon: "bg-muted text-muted-foreground",
  },
};

const toneIcon = { danger: OctagonAlert, warning: AlertTriangle, info: Info };
const toneLabel = { danger: "Mendesak", warning: "Perhatian", info: "Info" };

/** "Perlu perhatian hari ini" — maks 4 hal, tiap butir ikon + teks + tautan. */
export function ExecInsightStrip({ insights }: { insights: ExecInsight[] }) {
  if (insights.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/5 px-4 py-3">
        <CheckCircle2 className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
        <p className="text-sm text-foreground">
          Tidak ada hal mendesak hari ini.
        </p>
      </div>
    );
  }
  return (
    <section aria-label="Perlu perhatian hari ini">
      <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {insights.map((it) => {
          const Icon = toneIcon[it.tone];
          return (
            <li key={it.id}>
              <Link
                href={it.href}
                className={cn(
                  "group/insight flex h-full items-center gap-3 rounded-xl border px-3.5 py-3 transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                  toneStyle[it.tone].box,
                )}
              >
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-lg",
                    toneStyle[it.tone].icon,
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                    {toneLabel[it.tone]}
                  </span>
                  <span className="block text-sm leading-snug font-medium text-foreground">
                    {it.text}
                  </span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover/insight:translate-x-0.5" />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
