import Link from "next/link";
import {
  ArrowRight,
  Bell,
  Compass,
  ImageIcon,
  Loader2,
  MessageSquare,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import type { BrandHubDashboardData } from "@/lib/brand-research/dashboard";
import {
  BrandModuleHealthPanel,
  HealthBadge,
  healthLevelForModule,
} from "@/components/brand-hub/brand-module-health";
import {
  BrandHubPageHeader,
  BrandHubPageShell,
  BrandHubSection,
  BrandHubStatChip,
  hub,
} from "@/components/brand-hub/brand-hub-primitives";
import { cn } from "@/lib/utils";

type ModuleCard = {
  href: string;
  label: string;
  description: string;
  icon: typeof Target;
  count: number;
  countLabel: string;
  zone: "studio" | "intelligence";
  healthKey?: string;
};

const WORKFLOW = [
  {
    step: "01",
    title: "Research Hub (MA)",
    desc: "Review, keyword, USP, trend kategori, competitor, social",
  },
  {
    step: "02",
    title: "Susun strategi (PM)",
    desc: "Pilih sumber Research + Visual Library",
  },
  {
    step: "03",
    title: "Turunkan ke creative",
    desc: "Guideline, moodboard, palette",
  },
] as const;

export function BrandHubCommandCenter({
  data,
  brandId,
}: {
  data: BrandHubDashboardData;
  brandId?: string | null;
}) {
  const brandQs = brandId ? `?brandId=${encodeURIComponent(brandId)}` : "";

  const modules: ModuleCard[] = [
    {
      href: `/brand-hub/strategy${brandQs}`,
      label: "Brand Strategy",
      description: "Purpose, essence, USP branding, STP, personality, tone of voice.",
      icon: Compass,
      count: data.strategyReadyCount,
      countLabel: `siap / ${data.strategyCount}`,
      zone: "studio",
      healthKey: "brand-strategy",
    },
    {
      href: `/brand-hub/creative-guideline${brandQs}`,
      label: "Creative Guideline",
      description: "Moodboard, palette, typography, design references.",
      icon: Sparkles,
      count: data.creativeReadyCount,
      countLabel: `siap / ${data.creativeGuidelineCount}`,
      zone: "studio",
      healthKey: "creative-guideline",
    },
    {
      href: `/brand-hub/visual-library${brandQs}`,
      label: "Visual Library",
      description: "Pinterest, competitor, social & manual references.",
      icon: ImageIcon,
      count: data.visualAssetCount,
      countLabel: `assets · ${data.visualCollectionCount} koleksi`,
      zone: "studio",
      healthKey: "visual-library",
    },
    {
      href: `/brand-hub/competitor-tracker${brandQs}`,
      label: "Competitor Tracker",
      description: "Data kompetitor dari Research Hub — lihat & harvest visual.",
      icon: Target,
      count: data.competitorCount,
      countLabel: "kompetitor",
      zone: "intelligence",
      healthKey: "competitor-tracker",
    },
    {
      href: `/brand-hub/social-listening${brandQs}`,
      label: "Social Listening",
      description: "SOV, pain points, konten sosial dari Research Hub.",
      icon: MessageSquare,
      count: data.socialBatchReadyCount,
      countLabel: "batch siap",
      zone: "intelligence",
      healthKey: "social-listening",
    },
    {
      href: `/brand-hub/visual-trend${brandQs}`,
      label: "Visual Trend",
      description: "Analisis estetika Pinterest — tag, palet, brief kreatif.",
      icon: TrendingUp,
      count: data.visualCollectionCount,
      countLabel: "koleksi Pinterest",
      zone: "intelligence",
      healthKey: "visual-trend",
    },
  ];

  const studio = modules.filter((m) => m.zone === "studio");
  const intelligence = modules.filter((m) => m.zone === "intelligence");

  const statusTone =
    data.activeAlerts > 0
      ? "warning"
      : data.pendingJobs > 0
        ? "primary"
        : "success";

  const statusValue =
    data.activeAlerts > 0
      ? `${data.activeAlerts} alert`
      : data.pendingJobs > 0
        ? `${data.pendingJobs} job`
        : "Stabil";

  return (
    <BrandHubPageShell>
      <BrandHubPageHeader
        eyebrow="Command Center"
        title="Brand & Creative Hub"
        description="Market Analyst mengisi Research Hub → Brand Manager menyusun strategi & arahan kreatif dari pool data organisasi."
        footer={
          <div className="flex flex-wrap items-center gap-2">
            <BrandHubStatChip label="Status" value={statusValue} tone={statusTone} />
            <BrandHubStatChip
              label="Strategi siap"
              value={`${data.strategyReadyCount} / ${data.strategyCount}`}
            />
            <BrandHubStatChip label="Visual assets" value={data.visualAssetCount} />
            <BrandHubStatChip
              label="Research pool"
              value={`${data.reviewSourceReadyCount} review · ${data.trendDigestCount} trend`}
            />
            {data.activeAlerts > 0 ? (
              <span className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-800 dark:text-amber-300">
                <Bell className="size-3.5" />
                {data.activeAlerts} alert aktif
              </span>
            ) : null}
            {data.pendingJobs > 0 ? (
              <span className="inline-flex items-center gap-1.5 rounded-xl bg-primary/10 px-3 py-2 text-xs font-medium text-primary">
                <Loader2 className="size-3.5 animate-spin" />
                {data.pendingJobs} job berjalan
              </span>
            ) : null}
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_minmax(260px,320px)]">
        <div className="flex flex-col gap-8">
          <section className={cn(hub.card, hub.cardBody, hub.entrance)}>
            <p className={hub.label}>Alur kerja</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              {WORKFLOW.map((w, i) => (
                <div
                  key={w.step}
                  className={cn("relative flex flex-col gap-2", hub.entrance)}
                  style={i > 0 ? { animationDelay: `${i * 60}ms` } : undefined}
                >
                  <span className="text-primary text-xs font-bold tabular-nums">
                    {w.step}
                  </span>
                  <p className="text-sm font-semibold">{w.title}</p>
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    {w.desc}
                  </p>
                  {i < WORKFLOW.length - 1 ? (
                    <ArrowRight
                      className="text-muted-foreground/40 absolute top-1 -right-2 hidden size-4 sm:block"
                      aria-hidden
                    />
                  ) : null}
                </div>
              ))}
            </div>
          </section>

          <BrandHubSection
            title="Studio"
            description="Output strategis & kreatif — hasil akhir Brand Hub."
          >
            <ModuleBento modules={studio} health={data.health} />
          </BrandHubSection>

          <BrandHubSection
            title="Market Intelligence"
            description="Konsumsi data Research Hub — harvest visual & analisis estetika Pinterest."
          >
            <ModuleBento modules={intelligence} health={data.health} />
          </BrandHubSection>
        </div>

        <BrandModuleHealthPanel health={data.health} brandId={brandId} />
      </div>
    </BrandHubPageShell>
  );
}

function ModuleBento({
  modules,
  health,
}: {
  modules: ModuleCard[];
  health: BrandHubDashboardData["health"];
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {modules.map((m, index) => {
        const level = m.healthKey
          ? healthLevelForModule(health, m.healthKey)
          : "idle";

        return (
          <Link
            key={m.href}
            href={m.href}
            className={cn(
              hub.card,
              hub.cardHover,
              hub.entrance,
              "group flex flex-col gap-4 p-5",
              m.zone === "studio"
                ? "border-l-[3px] border-l-primary/50"
                : "border-l-[3px] border-l-muted-foreground/25",
            )}
            style={
              index > 0 && index < 8
                ? { animationDelay: `${index * 50}ms` }
                : undefined
            }
          >
            <div className="flex items-start justify-between gap-3">
              <span
                className={cn(
                  "flex size-10 items-center justify-center rounded-xl",
                  m.zone === "studio"
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground",
                )}
              >
                <m.icon className="size-5" aria-hidden />
              </span>
              {m.healthKey ? <HealthBadge level={level} /> : null}
            </div>
            <div>
              <p className="text-sm font-semibold group-hover:text-primary transition-colors">
                {m.label}
              </p>
              <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                {m.description}
              </p>
            </div>
            <p className="text-foreground mt-auto text-lg font-semibold tabular-nums">
              {m.count}{" "}
              <span className="text-muted-foreground text-xs font-normal">
                {m.countLabel}
              </span>
            </p>
          </Link>
        );
      })}
    </div>
  );
}
