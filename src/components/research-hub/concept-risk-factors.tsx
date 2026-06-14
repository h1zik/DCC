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
              "flex items-start gap-3 rounded-lg border border-l-4 p-3",
              SEVERITY_STYLE[risk.severity],
            )}
          >
            <AlertTriangle
              className="mt-0.5 size-4 shrink-0 text-muted-foreground"
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{risk.label}</p>
              <p className="text-xs text-muted-foreground">
                Keparahan: {SEVERITY_LABEL[risk.severity]} · Bukti:{" "}
                {risk.source.label}
              </p>
            </div>
            {href ? (
              <Link
                href={href}
                className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
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
