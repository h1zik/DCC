import Link from "next/link";
import { AlertTriangle, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

type RiskFactor = {
  label: string;
  severity: "HIGH" | "MED" | "LOW";
  source: { module: string; label: string; href?: string };
};

const SEVERITY_STYLE: Record<RiskFactor["severity"], string> = {
  HIGH: "border-l-rose-500 bg-rose-500/5",
  MED: "border-l-amber-500 bg-amber-500/5",
  LOW: "border-l-slate-400 bg-muted/40",
};

const SEVERITY_ICON: Record<RiskFactor["severity"], string> = {
  HIGH: "text-rose-600 dark:text-rose-400",
  MED: "text-amber-600 dark:text-amber-400",
  LOW: "text-muted-foreground",
};

const SEVERITY_PILL: Record<RiskFactor["severity"], string> = {
  HIGH: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  MED: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  LOW: "bg-muted text-muted-foreground",
};

const SEVERITY_LABEL: Record<RiskFactor["severity"], string> = {
  HIGH: "Tinggi",
  MED: "Sedang",
  LOW: "Rendah",
};

const MODULE_HREF: Record<string, string> = {
  "review-intelligence": "/research-hub/review-intelligence",
  "social-listening": "/research-hub/social-listening",
};

/**
 * Renders deterministic risk factors that were mapped from upstream evidence
 * (e.g. a real review complaint), each traceable back to its source module.
 */
export function ConceptRiskFactorList({ items }: { items: RiskFactor[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {items.map((risk, i) => {
        const href = risk.source.href ?? MODULE_HREF[risk.source.module];
        return (
          <li
            key={`${risk.label}-${i}`}
            className={cn(
              "flex items-start gap-3 rounded-xl border-l-4 p-3.5",
              SEVERITY_STYLE[risk.severity],
            )}
          >
            <AlertTriangle
              className={cn(
                "mt-0.5 size-4 shrink-0",
                SEVERITY_ICON[risk.severity],
              )}
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium leading-snug">{risk.label}</p>
              <p className="text-muted-foreground mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
                <span
                  className={cn(
                    "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold",
                    SEVERITY_PILL[risk.severity],
                  )}
                >
                  {SEVERITY_LABEL[risk.severity]}
                </span>
                <span>Bukti: {risk.source.label}</span>
              </p>
            </div>
            {href ? (
              <Link
                href={href}
                className="text-muted-foreground hover:text-foreground inline-flex shrink-0 items-center gap-1 text-xs font-semibold transition-colors"
              >
                Sumber
                <ArrowUpRight className="size-3" aria-hidden />
              </Link>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
