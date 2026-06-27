import Link from "next/link";
import {
  ArrowUpRight,
  BarChart3,
  Compass,
  MessageSquare,
  Package,
  Radar,
  Search,
  Star,
  Target,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  ContextMatchQuality,
  ResolvedContextSources,
  ResolvedSourceRef,
} from "@/lib/research/usp-gap/context-types";
import { cn } from "@/lib/utils";

type SourceKey = keyof ResolvedContextSources;

const SECTION_META: Record<
  SourceKey,
  { label: string; icon: LucideIcon; accent: string }
> = {
  reviewIntel: {
    label: "Review Intelligence",
    icon: Star,
    accent: "border-l-amber-500/70",
  },
  competitor: {
    label: "Competitor Tracker",
    icon: Target,
    accent: "border-l-rose-500/70",
  },
  trendRadar: {
    label: "Trend Radar",
    icon: Radar,
    accent: "border-l-sky-500/70",
  },
  keywordIntel: {
    label: "Keyword Intel",
    icon: Search,
    accent: "border-l-violet-500/70",
  },
  socialListening: {
    label: "Social Listening",
    icon: MessageSquare,
    accent: "border-l-emerald-500/70",
  },
  productDiscovery: {
    label: "Product Discovery",
    icon: Compass,
    accent: "border-l-orange-500/70",
  },
  competitorProducts: {
    label: "Competitor Products",
    icon: Package,
    accent: "border-l-pink-500/70",
  },
};

export function UspSourcesUsedPanel({
  sources,
  matchQuality,
}: {
  sources: ResolvedContextSources | null | undefined;
  matchQuality?: ContextMatchQuality | null;
}) {
  if (!sources) return null;

  const sections = (Object.keys(SECTION_META) as SourceKey[]).filter((key) => {
    const val = sources[key];
    if (Array.isArray(val)) return val.length > 0;
    return !!val;
  });

  if (sections.length === 0) return null;

  const totalRefs = sections.reduce((sum, key) => {
    const val = sources[key];
    return sum + (Array.isArray(val) ? val.length : val ? 1 : 0);
  }, 0);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-border/60 bg-muted/20 border-b pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="border-primary/30 bg-primary/10 text-primary flex size-8 items-center justify-center rounded-lg border">
              <BarChart3 className="size-4" aria-hidden />
            </span>
            Sumber data yang dipakai
          </CardTitle>
          <Badge variant="secondary" className="tabular-nums">
            {totalRefs} sumber · {sections.length} modul
          </Badge>
        </div>
        <p className="text-muted-foreground text-xs leading-relaxed">
          Jejak audit — klik sumber untuk melihat data mentah di modul asal.
        </p>
      </CardHeader>
      <CardContent className="grid gap-3 p-4 sm:grid-cols-2">
        {sections.map((key) => {
          const meta = SECTION_META[key];
          const Icon = meta.icon;
          const val = sources[key];
          const refs: ResolvedSourceRef[] = Array.isArray(val)
            ? val
            : val
              ? [val]
              : [];

          return (
            <section
              key={key}
              className={cn(
                "border-border/70 bg-card overflow-hidden rounded-xl border border-l-[3px] shadow-sm",
                meta.accent,
              )}
            >
              <div className="border-border/50 flex items-center gap-2 border-b px-3 py-2.5">
                <Icon className="text-muted-foreground size-3.5 shrink-0" />
                <span className="text-foreground min-w-0 flex-1 truncate text-xs font-semibold">
                  {meta.label}
                </span>
                {matchQuality?.[key] === "fallback" ? (
                  <Badge
                    variant="outline"
                    className="shrink-0 border-amber-500/40 text-[10px] text-amber-600 dark:text-amber-400"
                    title="Tidak ada sumber yang cocok kategori — dipakai data terbaru lintas-kategori."
                  >
                    lintas-kategori
                  </Badge>
                ) : null}
                <Badge variant="outline" className="shrink-0 text-[10px]">
                  {refs.length}
                </Badge>
              </div>
              <ul className="divide-border/50 divide-y p-1.5">
                {refs.map((src) => (
                  <li key={src.id}>
                    <SourceLink source={src} />
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </CardContent>
    </Card>
  );
}

function SourceLink({ source }: { source: ResolvedSourceRef }) {
  return (
    <Link
      href={source.href}
      className="group hover:bg-muted/50 flex items-center gap-2.5 rounded-lg px-2.5 py-2 transition-colors"
    >
      <span className="min-w-0 flex-1">
        <span className="text-foreground group-hover:text-primary block truncate text-sm font-medium transition-colors">
          {source.label}
        </span>
        {source.meta ? (
          <span className="text-muted-foreground block truncate text-[11px]">
            {source.meta}
          </span>
        ) : null}
      </span>
      <ArrowUpRight
        className="text-muted-foreground group-hover:text-primary size-3.5 shrink-0 opacity-0 transition-all group-hover:opacity-100"
        aria-hidden
      />
    </Link>
  );
}
