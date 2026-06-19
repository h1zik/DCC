import Link from "next/link";
import {
  ArrowUpRight,
  BarChart3,
  Bell,
  Compass,
  ImageIcon,
  Loader2,
  MessageSquare,
  Radar,
  Search,
  Sparkles,
  Star,
  Target,
} from "lucide-react";
import type { BrandHubDashboardData } from "@/lib/brand-research/dashboard";
import { cn } from "@/lib/utils";

type ModuleCard = {
  href: string;
  label: string;
  description: string;
  icon: typeof Target;
  count: number;
  countLabel: string;
  tone: "neutral" | "accent" | "warning";
};

export function BrandHubCommandCenter({ data }: { data: BrandHubDashboardData }) {
  const primaryModules: ModuleCard[] = [
    {
      href: "/brand-hub/strategy",
      label: "Brand Strategy",
      description: "Purpose, essence, USP branding, STP, personality, dan tone of voice.",
      icon: Compass,
      count: data.strategyReadyCount,
      countLabel: `dokumen siap / ${data.strategyCount} total`,
      tone: "accent",
    },
    {
      href: "/brand-hub/creative-guideline",
      label: "Creative Guideline",
      description: "Moodboard, palette, typography, dan design references untuk tim creative.",
      icon: Sparkles,
      count: data.creativeReadyCount,
      countLabel: `guideline siap / ${data.creativeGuidelineCount} total`,
      tone: "accent",
    },
    {
      href: "/brand-hub/visual-library",
      label: "Visual Library",
      description: "Referensi visual dari Pinterest dan listing kompetitor.",
      icon: ImageIcon,
      count: data.visualAssetCount,
      countLabel: `assets · ${data.visualCollectionCount} koleksi`,
      tone: "neutral",
    },
  ];

  const evidenceModules: ModuleCard[] = [
    {
      href: "/brand-hub/competitor-tracker",
      label: "Competitor Tracker",
      description: "Sinyal pasar: harga, portfolio, dan perubahan listing kompetitor.",
      icon: Target,
      count: data.competitorCount,
      countLabel: "kompetitor",
      tone: "neutral",
    },
    {
      href: "/brand-hub/review-intelligence",
      label: "Review Intel",
      description: "Persepsi konsumen dari review — input emosional untuk strategi brand.",
      icon: Star,
      count: data.reviewSourceCount,
      countLabel: "sumber review",
      tone: "neutral",
    },
    {
      href: "/brand-hub/trend-radar",
      label: "Trend Radar",
      description: "Early signal tren kategori dan visual yang mempengaruhi positioning.",
      icon: Radar,
      count: data.trendDigestCount,
      countLabel: "digest",
      tone: "neutral",
    },
    {
      href: "/brand-hub/keyword-intel",
      label: "Keyword Intel",
      description: "Intent pencarian konsumen — konteks segmentasi STP.",
      icon: Search,
      count: data.keywordQueryCount,
      countLabel: "query",
      tone: "neutral",
    },
    {
      href: "/brand-hub/social-listening",
      label: "Social Listening",
      description: "Tone sosial dan share of voice vs kompetitor.",
      icon: MessageSquare,
      count: data.socialMonitorCount,
      countLabel: "monitor",
      tone: "neutral",
    },
    {
      href: "/brand-hub/usp-analyzer",
      label: "USP Analyzer",
      description: "Gap positioning produk — feeder evidence, bukan output utama brand.",
      icon: BarChart3,
      count: data.uspAnalysisCount,
      countLabel: "analisis",
      tone: "neutral",
    },
  ];

  const toneRing = {
    neutral: "ring-foreground/10",
    accent: "ring-accent/30",
    warning: "ring-amber-500/25",
  };
  const toneIcon = {
    neutral: "bg-muted text-muted-foreground",
    accent: "bg-accent/15 text-accent-foreground",
    warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        {data.activeAlerts > 0 ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-700 dark:text-amber-300">
            <Bell className="size-3.5" />
            {data.activeAlerts} alert aktif
          </span>
        ) : null}
        {data.pendingJobs > 0 ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">
            <Loader2 className="size-3.5 animate-spin" />
            {data.pendingJobs} job berjalan
          </span>
        ) : null}
        {data.activeAlerts === 0 && data.pendingJobs === 0 ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
            Semua tenang — tidak ada alert atau job tertunda
          </span>
        ) : null}
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold tracking-tight">Strategy & Creative</h2>
        <ModuleGrid modules={primaryModules} toneRing={toneRing} toneIcon={toneIcon} />
      </section>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">Market Evidence</h2>
          <p className="text-muted-foreground text-xs">
            Modul riset pasar sebagai bahan baku strategi — bukan output utama Brand Hub.
          </p>
        </div>
        <ModuleGrid modules={evidenceModules} toneRing={toneRing} toneIcon={toneIcon} />
      </section>
    </div>
  );
}

function ModuleGrid({
  modules,
  toneRing,
  toneIcon,
}: {
  modules: ModuleCard[];
  toneRing: Record<string, string>;
  toneIcon: Record<string, string>;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {modules.map((m) => (
        <Link
          key={m.href}
          href={m.href}
          className={cn(
            "group flex flex-col gap-3 rounded-xl bg-card px-4 py-4 ring-1 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md",
            toneRing[m.tone],
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <span
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-lg",
                toneIcon[m.tone],
              )}
            >
              <m.icon className="size-4.5" />
            </span>
            <ArrowUpRight
              className="size-4 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
              aria-hidden
            />
          </div>
          <div className="flex flex-1 flex-col gap-1.5">
            <h3 className="text-sm font-semibold tracking-tight text-foreground">
              {m.label}
            </h3>
            <p className="text-xs leading-snug text-muted-foreground">
              {m.description}
            </p>
          </div>
          <div className="flex items-center gap-1.5 border-t border-border/50 pt-2.5 text-xs">
            <span className="text-lg font-semibold tabular-nums text-foreground">
              {m.count}
            </span>
            <span className="text-muted-foreground">{m.countLabel}</span>
          </div>
        </Link>
      ))}
    </div>
  );
}
