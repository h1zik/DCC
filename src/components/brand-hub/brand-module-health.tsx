import Link from "next/link";
import type { BrandModuleHealth } from "@/lib/brand-research/dashboard-health";
import type { DataHealthLevel } from "@/lib/brand-research/dashboard-health";
import { lab } from "@/components/lab/lab-primitives";
import { cn } from "@/lib/utils";

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

const MODULE_LABELS: Record<string, { title: string; href: string }> = {
  "brand-strategy": { title: "Brand Strategy", href: "/brand-hub/strategy" },
  "creative-guideline": {
    title: "Creative Guideline",
    href: "/brand-hub/creative-guideline",
  },
  "visual-library": { title: "Visual Library", href: "/brand-hub/visual-library" },
  "visual-trend": { title: "Visual Trend", href: "/brand-hub/visual-trend" },
  "social-listening": {
    title: "Social Listening",
    href: "/brand-hub/social-listening",
  },
  "competitor-tracker": {
    title: "Competitor Tracker",
    href: "/brand-hub/competitor-tracker",
  },
  "research-review": { title: "Review Intel (Research)", href: "/brand-hub/strategy" },
  "research-trend": { title: "Trend Radar (Research)", href: "/brand-hub/strategy" },
  "research-keyword": { title: "Keyword Intel", href: "/brand-hub/keyword-intel" },
  "research-usp": { title: "USP Analyzer (Research)", href: "/brand-hub/strategy" },
};

export function BrandModuleHealthPanel({
  health,
  brandId,
  className,
}: {
  health: BrandModuleHealth[];
  brandId?: string | null;
  className?: string;
}) {
  const healthByKey = new Map(health.map((h) => [h.key, h]));

  const moduleKeys = [
    "brand-strategy",
    "creative-guideline",
    "visual-library",
    "visual-trend",
    "competitor-tracker",
    "social-listening",
    "research-review",
    "research-trend",
    "research-keyword",
    "research-usp",
  ];

  return (
    <aside className={cn(lab.card, "h-fit p-4", className)}>
      <p className={lab.label}>Kesehatan modul</p>
      <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
        Review, keyword, USP, dan trend kategori dikelola di Research Hub — dipakai
        saat generate strategi.
      </p>
      <ul className="mt-4 space-y-2">
        {moduleKeys.map((key) => {
          const meta = MODULE_LABELS[key];
          const item = healthByKey.get(key);
          if (!meta || !item) return null;
          const levelMeta = HEALTH_META[item.level];
          const href = brandId
            ? `${meta.href}?brandId=${encodeURIComponent(brandId)}`
            : meta.href;

          return (
            <li key={key}>
              <Link
                href={href}
                className="hover:bg-muted/60 flex items-start gap-2 rounded-lg px-2 py-2 transition-colors"
              >
                <span
                  className={cn("mt-1.5 size-2 shrink-0 rounded-full", levelMeta.dot)}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium">{meta.title}</span>
                    <span
                      className={cn(
                        "rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase",
                        levelMeta.tone,
                      )}
                    >
                      {levelMeta.label}
                    </span>
                  </div>
                  <p className="text-muted-foreground mt-0.5 text-[10px] leading-snug">
                    {item.detail}
                  </p>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}

export function HealthBadge({ level }: { level: DataHealthLevel }) {
  const meta = HEALTH_META[level];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
        meta.tone,
      )}
    >
      <span className={cn("size-1.5 rounded-full", meta.dot)} aria-hidden />
      {meta.label}
    </span>
  );
}

export function healthLevelForModule(
  health: BrandModuleHealth[],
  key: string,
): DataHealthLevel {
  return health.find((h) => h.key === key)?.level ?? "idle";
}
