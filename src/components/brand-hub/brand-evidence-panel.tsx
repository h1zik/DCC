"use client";

import Link from "next/link";
import { AlertTriangle, CheckCircle2, Circle, ExternalLink } from "lucide-react";
import type {
  DemoFlag,
  EvidenceReadiness,
  EvidenceRef,
} from "@/lib/brand-research/strategy/evidence-types";
import { brandHubHref } from "@/hooks/use-brand-hub-brand-id";
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
  const metCount = readiness.checks.filter((c) => c.met).length;
  const allMet = metCount === readiness.checks.length;

  return (
    <section className={cn("bento-tile justify-start gap-4", className)}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <span className="bento-label">Market Evidence</span>
          <p className="text-muted-foreground mt-0.5 text-xs">
            Checklist syarat generate & bukti yang dipakai AI.
          </p>
        </div>
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold tabular-nums",
            allMet
              ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
              : "bg-amber-500/12 text-amber-700 dark:text-amber-300",
          )}
        >
          <span
            className={cn(
              "size-1.5 rounded-full",
              allMet ? "bg-emerald-500" : "bg-amber-500",
            )}
            aria-hidden
          />
          {metCount}/{readiness.checks.length} syarat terpenuhi
        </span>
      </div>

      {readiness.demoFlags.length > 0 ? (
        <DemoBanner flags={readiness.demoFlags} />
      ) : null}

      <ul className="grid gap-2 sm:grid-cols-2">
        {readiness.checks.map((c) => (
          <li
            key={c.key}
            className={cn(
              "flex items-start gap-2.5 rounded-xl px-3 py-2.5 text-xs",
              c.met ? "bg-emerald-500/10" : "bg-rose-500/10",
            )}
          >
            {c.met ? (
              <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <Circle className="mt-0.5 size-3.5 shrink-0 text-rose-500" />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    "font-medium",
                    c.met
                      ? "text-foreground"
                      : "text-rose-700 dark:text-rose-300",
                  )}
                >
                  {c.label}
                </span>
                <Link
                  href={c.href}
                  className="text-[var(--lab-accent,var(--primary))] inline-flex items-center gap-0.5 font-medium hover:underline"
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
        <div className="rounded-xl bg-amber-500/10 px-3.5 py-2.5">
          <p className="mb-1 text-xs font-semibold text-amber-800 dark:text-amber-200">
            Opsional — memperkaya strategi
          </p>
          <ul className="space-y-1">
            {readiness.warnings.map((w) => (
              <li key={w.key} className="text-muted-foreground text-xs">
                <Link href={w.href} className="font-medium hover:underline">
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
          <p className="bento-label mb-2">
            Bukti AI · {refs.length} evidence refs
          </p>
          <ul className="max-h-48 space-y-2 overflow-y-auto">
            {refs.map((r, i) => {
              const href = sourceHref(r.source, r.sourceId, brandId ?? null);
              return (
                <li
                  key={`${r.field}-${i}`}
                  className="border-border/60 bg-muted/20 rounded-xl border px-3 py-2 text-xs"
                >
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-semibold">{r.field}</span>
                    <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                      {r.source}
                    </span>
                  </div>
                  <p className="text-muted-foreground mt-1 leading-relaxed">{r.snippet}</p>
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
        </div>
      ) : null}
    </section>
  );
}

function DemoBanner({ flags }: { flags: DemoFlag[] }) {
  return (
    <div className="flex gap-2 rounded-xl border border-orange-500/30 bg-orange-500/10 px-3.5 py-2.5">
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-orange-600 dark:text-orange-400" />
      <div className="min-w-0 text-xs">
        <p className="font-semibold text-orange-800 dark:text-orange-200">
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
