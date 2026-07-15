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
  LabPageShell,
  LabSection,
  lab,
} from "@/components/lab/lab-primitives";
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

  const statusValue =
    data.activeAlerts > 0
      ? `${data.activeAlerts} alert`
      : data.pendingJobs > 0
        ? `${data.pendingJobs} job`
        : "Stabil";

  return (
    <LabPageShell className="gap-6">
      {/* Header bento: display besar, tanpa chip/gradient. */}
      <header className={cn(lab.entrance, "space-y-1.5")}>
        <h1 className="text-foreground text-3xl font-extrabold tracking-tight sm:text-4xl">
          Brand &amp; Creative <span className="text-primary">Hub</span>
        </h1>
        <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed sm:text-[15px]">
          Market Analyst mengisi Research Hub → Brand Manager menyusun strategi
          &amp; arahan kreatif dari pool data organisasi.
        </p>
      </header>

      {/* Papan bento metrik */}
      <div
        className={cn(
          lab.entrance,
          "grid grid-flow-row-dense auto-rows-[6.75rem] grid-cols-2 gap-3 md:grid-cols-4",
        )}
      >
        {/* Status — tile hero pink, dua baris */}
        <div className="bento-tile row-span-2 border-transparent bg-pink-600 shadow-md shadow-pink-600/20 dark:bg-pink-500">
          <span className="text-[11.5px] font-semibold text-pink-100 dark:text-pink-950/70">
            Status brand hub
          </span>
          <span className="bento-value text-4xl text-white dark:text-pink-950">
            {statusValue}
          </span>
          <span className="text-xs font-medium leading-snug text-pink-100/90 dark:text-pink-900/80">
            {data.activeAlerts > 0
              ? "ada alert aktif — tinjau modul intelligence"
              : data.pendingJobs > 0
                ? "job kreatif sedang berjalan di background"
                : "strategi & aset kreatif dalam kondisi sinkron"}
          </span>
        </div>

        <div className="bento-tile">
          <span className="bento-label">Strategi siap</span>
          <span className="bento-value text-2xl">
            {data.strategyReadyCount}
            <span className="text-muted-foreground/60 text-lg font-bold">
              {" "}
              / {data.strategyCount}
            </span>
          </span>
        </div>

        <div className="bento-tile">
          <span className="bento-label">Visual assets</span>
          <span className="bento-value text-2xl">{data.visualAssetCount}</span>
        </div>

        <div className="bento-tile col-span-2">
          <span className="bento-label">Research pool</span>
          <span className="bento-value text-2xl">
            {data.reviewSourceReadyCount}
            <span className="text-muted-foreground text-sm font-semibold">
              {" "}
              review
            </span>{" "}
            · {data.trendDigestCount}
            <span className="text-muted-foreground text-sm font-semibold">
              {" "}
              trend
            </span>
          </span>
        </div>

        <div className="bento-tile border-transparent bg-[#ffedcd] dark:bg-amber-400/10">
          <span className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-amber-800/70 dark:text-amber-200/60">
            <Bell className="size-3.5" />
            Alert aktif
          </span>
          <span className="bento-value text-2xl text-amber-900 dark:text-amber-300">
            {data.activeAlerts}
          </span>
        </div>

        <div className="bento-tile border-transparent bg-[#fde7f1] dark:bg-pink-400/10">
          <span className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-pink-800/70 dark:text-pink-200/60">
            {data.pendingJobs > 0 ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : null}
            Job berjalan
          </span>
          <span className="bento-value text-2xl text-pink-900 dark:text-pink-300">
            {data.pendingJobs}
          </span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_minmax(260px,320px)]">
        <div className="flex flex-col gap-8">
          <section className={cn(lab.card, lab.cardBody, lab.entrance)}>
            <p className={lab.label}>Alur kerja</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              {WORKFLOW.map((w, i) => (
                <div
                  key={w.step}
                  className={cn("relative flex flex-col gap-2", lab.entrance)}
                  style={i > 0 ? { animationDelay: `${i * 60}ms` } : undefined}
                >
                  <span className="text-[var(--lab-accent,var(--primary))] text-xs font-bold tabular-nums">
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

          <LabSection
            title="Studio"
            description="Output strategis & kreatif — hasil akhir Brand Hub."
          >
            <ModuleBento modules={studio} health={data.health} />
          </LabSection>

          <LabSection
            title="Market Intelligence"
            description="Konsumsi data Research Hub — harvest visual & analisis estetika Pinterest."
          >
            <ModuleBento modules={intelligence} health={data.health} />
          </LabSection>
        </div>

        <BrandModuleHealthPanel health={data.health} brandId={brandId} />
      </div>
    </LabPageShell>
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
              lab.card,
              lab.cardHover,
              lab.entrance,
              "group flex flex-col gap-4 p-5",
              m.zone === "studio"
                ? "border-l-[3px] border-l-[color-mix(in_srgb,var(--lab-accent,var(--primary))_50%,transparent)]"
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
                    ? "bg-[color-mix(in_srgb,var(--lab-accent,var(--primary))_10%,transparent)] text-[var(--lab-accent,var(--primary))]"
                    : "bg-muted text-muted-foreground",
                )}
              >
                <m.icon className="size-5" aria-hidden />
              </span>
              {m.healthKey ? <HealthBadge level={level} /> : null}
            </div>
            <div>
              <p className="text-sm font-semibold group-hover:text-[var(--lab-accent,var(--primary))] transition-colors">
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
