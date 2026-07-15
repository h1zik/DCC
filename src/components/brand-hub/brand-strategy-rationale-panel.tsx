"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import type { EvidenceRef, StrategyFieldRationale } from "@/lib/brand-research/strategy/evidence-types";
import { brandHubHref } from "@/hooks/use-brand-hub-brand-id";
import { cn } from "@/lib/utils";

function parseRationales(raw: unknown): StrategyFieldRationale[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (r): r is StrategyFieldRationale =>
      typeof r === "object" &&
      r != null &&
      typeof (r as StrategyFieldRationale).field === "string" &&
      typeof (r as StrategyFieldRationale).reasoning === "string",
  );
}

function sourceHref(
  source: string,
  sourceId: string | undefined,
  brandId: string | null,
): string | null {
  if (!sourceId) return null;
  const base: Record<string, string> = {
    review: `/brand-hub/strategy`,
    social: `/brand-hub/social-listening/${sourceId}`,
    competitor: `/brand-hub/competitor-tracker/${sourceId}`,
    keyword: `/brand-hub/strategy`,
    trend: `/brand-hub/visual-trend`,
    usp: `/brand-hub/strategy`,
    visual: `/brand-hub/visual-library`,
  };
  const path = base[source];
  if (!path) return null;
  return brandHubHref(path, brandId);
}

/** Pill keyakinan AI — tinted per level (emerald/amber/rose). */
const CONFIDENCE_META: Record<string, { label: string; pill: string; dot: string }> = {
  high: {
    label: "Keyakinan tinggi",
    pill: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
  medium: {
    label: "Keyakinan sedang",
    pill: "bg-amber-500/12 text-amber-700 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  low: {
    label: "Keyakinan rendah",
    pill: "bg-rose-500/12 text-rose-700 dark:text-rose-300",
    dot: "bg-rose-500",
  },
};

export function BrandStrategyRationalePanel({
  rationales,
  brandId,
  className,
}: {
  rationales?: unknown;
  brandId?: string | null;
  className?: string;
}) {
  const items = parseRationales(rationales);
  if (items.length === 0) return null;

  return (
    <section className={cn("bento-tile justify-start gap-4", className)}>
      <div>
        <span className="bento-label">Alasan & bukti per komponen</span>
        <p className="text-muted-foreground mt-0.5 text-xs">
          Penjelasan detail mengapa AI memilih setiap elemen strategi, beserta kutipan data.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {items.map((r) => {
          const conf = r.confidence ? CONFIDENCE_META[r.confidence] : null;
          return (
            <article
              key={r.field}
              className="border-border/60 bg-muted/20 rounded-xl border p-4"
            >
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <h4 className="text-sm font-semibold tracking-tight">
                  {r.label ?? r.field}
                </h4>
                {r.confidence ? (
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                      conf?.pill ?? "bg-muted text-muted-foreground",
                    )}
                  >
                    <span
                      className={cn(
                        "size-1.5 rounded-full",
                        conf?.dot ?? "bg-muted-foreground/50",
                      )}
                      aria-hidden
                    />
                    {conf?.label ?? r.confidence}
                  </span>
                ) : null}
              </div>
              <p className="text-sm leading-relaxed">{r.reasoning}</p>

              {r.evidenceRefs?.length ? (
                <ul className="border-border/40 mt-3 space-y-2 border-t pt-3">
                  {r.evidenceRefs.map((ref: EvidenceRef, i: number) => {
                    const href = sourceHref(ref.source, ref.sourceId, brandId ?? null);
                    return (
                      <li
                        key={`${r.field}-ev-${i}`}
                        className="bg-card rounded-lg px-2.5 py-2 text-xs shadow-sm"
                      >
                        <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                          {ref.source}
                        </span>
                        <p className="text-muted-foreground mt-1.5 leading-relaxed">
                          {ref.snippet}
                        </p>
                        {href ? (
                          <Link
                            href={href}
                            className="text-[var(--lab-accent,var(--primary))] mt-1 inline-flex items-center gap-0.5 font-medium hover:underline"
                          >
                            Lihat sumber
                            <ExternalLink className="size-3" />
                          </Link>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
