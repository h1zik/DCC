"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import type { EvidenceRef, StrategyFieldRationale } from "@/lib/brand-research/strategy/evidence-types";
import { brandHubHref } from "@/hooks/use-brand-hub-brand-id";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { hub } from "@/components/brand-hub/brand-hub-primitives";

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

const CONFIDENCE_LABEL: Record<string, string> = {
  high: "Tinggi",
  medium: "Sedang",
  low: "Rendah",
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
    <section className={cn(hub.panel, className)}>
      <h3 className={hub.sectionTitle}>Alasan & bukti per komponen</h3>
      <p className={cn(hub.sectionDesc, "mb-4")}>
        Penjelasan detail mengapa AI memilih setiap elemen strategi, beserta kutipan data.
      </p>

      <div className="flex flex-col gap-3">
        {items.map((r) => (
          <article
            key={r.field}
            className="rounded-lg border border-border/50 bg-muted/10 p-3"
          >
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <h4 className="text-sm font-medium">{r.label ?? r.field}</h4>
              {r.confidence ? (
                <Badge variant="secondary" className="text-[10px]">
                  Keyakinan: {CONFIDENCE_LABEL[r.confidence] ?? r.confidence}
                </Badge>
              ) : null}
            </div>
            <p className="text-sm leading-relaxed">{r.reasoning}</p>

            {r.evidenceRefs?.length ? (
              <ul className="mt-3 space-y-2 border-t border-border/40 pt-3">
                {r.evidenceRefs.map((ref: EvidenceRef, i: number) => {
                  const href = sourceHref(ref.source, ref.sourceId, brandId ?? null);
                  return (
                    <li
                      key={`${r.field}-ev-${i}`}
                      className="rounded-md bg-background/60 px-2.5 py-2 text-xs"
                    >
                      <span className="font-medium">{ref.source}</span>
                      <p className="text-muted-foreground mt-0.5 leading-relaxed">
                        {ref.snippet}
                      </p>
                      {href ? (
                        <Link
                          href={href}
                          className="text-primary mt-1 inline-flex items-center gap-0.5 hover:underline"
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
        ))}
      </div>
    </section>
  );
}
