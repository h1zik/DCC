"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "warning" | "danger" | "success" | "accent";

const toneRing: Record<Tone, string> = {
  neutral: "ring-foreground/10",
  warning: "ring-amber-500/25",
  danger: "ring-destructive/25",
  success: "ring-emerald-500/25",
  accent: "ring-accent/40",
};

const toneIconBg: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground",
  warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  danger: "bg-destructive/10 text-destructive",
  success: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  accent: "bg-accent/15 text-accent-foreground",
};

const toneBar: Record<Tone, string> = {
  neutral: "bg-foreground/15",
  warning: "bg-amber-500",
  danger: "bg-destructive",
  success: "bg-emerald-500",
  accent: "bg-accent",
};

type KpiCardProps = {
  label: string;
  value: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: Tone;
  /** 0–100, drives the thin bottom indicator bar. */
  indicator?: number;
  /** Navigasi antar-halaman — dirender sebagai <Link> (client-side, tanpa reload). */
  href?: string;
  /** Aksi dalam halaman (mis. ganti tab) — dirender sebagai <button>. */
  onSelect?: () => void;
  ctaLabel?: string;
};

export function ExecutiveKpiCard({
  label,
  value,
  description,
  icon,
  tone = "neutral",
  indicator,
  href,
  onSelect,
  ctaLabel,
}: KpiCardProps) {
  const interactive = Boolean(href || onSelect);
  const className = cn(
    "group/kpi relative flex flex-col gap-3 rounded-xl bg-card px-4 py-3.5 ring-1 transition-[box-shadow,transform] duration-200",
    "hover:shadow-sm hover:-translate-y-0.5",
    toneRing[tone],
    interactive &&
      "cursor-pointer text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
  );
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
          {label}
        </span>
        {icon ? (
          <span
            className={cn(
              "flex size-7 shrink-0 items-center justify-center rounded-lg",
              toneIconBg[tone],
            )}
          >
            {icon}
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col justify-end gap-1.5">
        <span className="text-3xl font-semibold tracking-tight tabular-nums text-foreground">
          {value}
        </span>
        {description ? (
          <span className="text-xs leading-snug text-muted-foreground">
            {description}
          </span>
        ) : null}
      </div>

      {typeof indicator === "number" ? (
        <span
          aria-hidden
          className={cn(
            "absolute inset-x-0 bottom-0 h-0.5 rounded-b-xl",
            toneBar[tone],
          )}
          style={{ width: `${Math.max(0, Math.min(100, indicator))}%` }}
        />
      ) : null}

      {ctaLabel && interactive ? (
        <span className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-accent-foreground">
          {ctaLabel}
          <svg
            aria-hidden
            viewBox="0 0 16 16"
            className="size-3 transition-transform duration-200 group-hover/kpi:translate-x-0.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6 3l5 5-5 5" />
          </svg>
        </span>
      ) : null}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={className}>
        {body}
      </Link>
    );
  }
  if (onSelect) {
    return (
      <button type="button" onClick={onSelect} className={className}>
        {body}
      </button>
    );
  }
  return <div className={className}>{body}</div>;
}