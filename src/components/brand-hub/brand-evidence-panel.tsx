"use client";

import Link from "next/link";
import { AlertTriangle, CheckCircle2, Circle, ExternalLink } from "lucide-react";
import type {
  DemoFlag,
  EvidenceReadiness,
  EvidenceRef,
} from "@/lib/brand-research/strategy/evidence-types";
import { brandHubHref } from "@/hooks/use-brand-hub-brand-id";
import { hub } from "@/components/brand-hub/brand-hub-primitives";
import { cn } from "@/lib/utils";

function parseEvidenceRefs(raw: unknown): EvidenceRef[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (r): r is EvidenceRef =>
      typeof r === "object" &&
      r != null &&
      typeof (r as EvidenceRef).field === "string" &&
      typeof (r as EvidenceRef).source === "string" &&
      typeof (r as EvidenceRef).snippet === "string",
  );
}

function sourceHref(source: string, sourceId: string | undefined, brandId: string | null): string | null {
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

export function BrandEvidencePanel({
  readiness,
  evidenceRefs,
  brandId,
  className,
}: {
  readiness: EvidenceReadiness;
  evidenceRefs?: unknown;
  brandId?: string | null;
  className?: string;
}) {
  const refs = parseEvidenceRefs(evidenceRefs);

  return (
    <section className={cn(hub.panel, className)}>
      <div className="mb-4">
        <h3 className={hub.sectionTitle}>Market Evidence</h3>
        <p className={hub.sectionDesc}>
          Checklist syarat generate & bukti yang dipakai AI.
        </p>
      </div>

      {readiness.demoFlags.length > 0 ? (
        <DemoBanner flags={readiness.demoFlags} />
      ) : null}

      <ul className="mb-4 space-y-2">
        {readiness.checks.map((c) => (
          <li key={c.key} className="flex items-start gap-2 text-xs">
            {c.met ? (
              <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
            ) : (
              <Circle className="mt-0.5 size-3.5 shrink-0 text-destructive" />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className={cn(c.met ? "text-foreground" : "text-destructive")}>
                  {c.label}
                </span>
                <Link
                  href={c.href}
                  className="text-primary inline-flex items-center gap-0.5 hover:underline"
                >
                  Isi data
                  <ExternalLink className="size-3" />
                </Link>
              </div>
              {c.detail ? (
                <p className="text-muted-foreground mt-0.5">{c.detail}</p>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      {readiness.warnings.length > 0 ? (
        <div className="mb-4 rounded-lg bg-amber-500/10 px-3 py-2">
          <p className="text-amber-800 dark:text-amber-200 mb-1 text-xs font-medium">
            Opsional — memperkaya strategi
          </p>
          <ul className="space-y-1">
            {readiness.warnings.map((w) => (
              <li key={w.key} className="text-muted-foreground text-xs">
                <Link href={w.href} className="hover:underline">
                  {w.label}
                </Link>
                {" — "}
                {w.detail}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {refs.length > 0 ? (
        <div>
          <p className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
            Bukti AI (evidence refs)
          </p>
          <ul className="max-h-48 space-y-2 overflow-y-auto">
            {refs.map((r, i) => {
              const href = sourceHref(r.source, r.sourceId, brandId ?? null);
              return (
                <li
                  key={`${r.field}-${i}`}
                  className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-xs"
                >
                  <span className="font-medium">{r.field}</span>
                  <span className="text-muted-foreground"> · {r.source}</span>
                  <p className="text-muted-foreground mt-1 leading-relaxed">{r.snippet}</p>
                  {href ? (
                    <Link href={href} className="text-primary mt-1 inline-flex items-center gap-0.5 hover:underline">
                      Lihat sumber
                      <ExternalLink className="size-3" />
                    </Link>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function DemoBanner({ flags }: { flags: DemoFlag[] }) {
  return (
    <div className="mb-4 flex gap-2 rounded-lg border border-orange-500/30 bg-orange-500/10 px-3 py-2">
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-orange-600 dark:text-orange-400" />
      <div className="min-w-0 text-xs">
        <p className="font-medium text-orange-800 dark:text-orange-200">
          Data demo terdeteksi — jangan jadikan dasar keputusan final
        </p>
        <ul className="text-muted-foreground mt-1 list-disc pl-4">
          {flags.map((f) => (
            <li key={f.module}>
              <strong>{f.label}:</strong> {f.detail}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function BrandReadinessSummary({
  readiness,
  brandId,
}: {
  readiness: EvidenceReadiness;
  brandId?: string | null;
}) {
  return (
    <BrandEvidencePanel
      readiness={readiness}
      brandId={brandId}
      className="mb-4"
    />
  );
}
