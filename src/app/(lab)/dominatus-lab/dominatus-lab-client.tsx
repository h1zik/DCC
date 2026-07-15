"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import {
  ArrowUpRight,
  ChevronRight,
  FlaskConical,
  Gauge,
  Lock,
  Microscope,
  Palette,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { CountUp } from "@/components/lab/count-up";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type LabAccess = {
  brandHub: boolean;
  researchHub: boolean;
  seo: boolean;
  contentStudio: boolean;
};

type LabStats = {
  brandStrategies: number;
  brandVisualAssets: number;
  researchReports: number;
  researchCompetitors: number;
  seoKeywords: number;
  seoTracked: number;
  contentIdeas: number;
  contentIdeaSets: number;
};

type LabModule = {
  key: keyof LabAccess;
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  /** Tile pastel per modul (light + dark). */
  tileClass: string;
  /** Kapsul ikon tinted per modul. */
  capsuleClass: string;
  lockedLabel: string;
  stats: { label: string; value: number }[];
  links: { label: string; href: string }[];
};

function buildModules(stats: LabStats): LabModule[] {
  return [
    {
      key: "brandHub",
      title: "Brand & Creative Hub",
      description:
        "Identitas brand, strategi, dan aset kreatif dalam satu pusat kendali.",
      href: "/brand-hub",
      icon: Palette,
      tileClass: "border-transparent bg-[#fde7f1] dark:bg-pink-400/10",
      capsuleClass: "bg-pink-500/15 text-pink-700 dark:text-pink-300",
      lockedLabel: "Khusus Brand Manager",
      stats: [
        { label: "dokumen strategi", value: stats.brandStrategies },
        { label: "aset visual", value: stats.brandVisualAssets },
      ],
      links: [
        { label: "Strategi Brand", href: "/brand-hub/strategy" },
        { label: "Visual Library", href: "/brand-hub/visual-library" },
        { label: "Creative Guideline", href: "/brand-hub/creative-guideline" },
      ],
    },
    {
      key: "researchHub",
      title: "Research Hub",
      description:
        "Intelijen pasar: kompetitor, tren, dan laporan riset mendalam.",
      href: "/research-hub",
      icon: Microscope,
      tileClass: "border-transparent bg-[#e9e3f9] dark:bg-violet-400/10",
      capsuleClass: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
      lockedLabel: "Khusus Market Analyst & Brand Manager",
      stats: [
        { label: "laporan siap", value: stats.researchReports },
        { label: "kompetitor terpantau", value: stats.researchCompetitors },
      ],
      links: [
        { label: "Research Reports", href: "/research-hub/research-reports" },
        { label: "Keyword Intel", href: "/research-hub/keyword-intel" },
        { label: "Trend Radar", href: "/research-hub/trend-radar" },
      ],
    },
    {
      key: "seo",
      title: "SEO Toolkit",
      description:
        "Riset keyword, pantau peringkat, dan audit performa organik.",
      href: "/seo",
      icon: Gauge,
      tileClass: "border-transparent bg-[#d9f2ee] dark:bg-teal-400/10",
      capsuleClass: "bg-teal-500/15 text-teal-700 dark:text-teal-300",
      lockedLabel: "Khusus Market Analyst & Brand Manager",
      stats: [
        { label: "keyword diriset", value: stats.seoKeywords },
        { label: "keyword dilacak", value: stats.seoTracked },
      ],
      links: [
        { label: "Keyword Research", href: "/seo/keyword-research" },
        { label: "Rank Tracker", href: "/seo/rank-tracker" },
        { label: "Content Engine", href: "/seo/content" },
      ],
    },
    {
      key: "contentStudio",
      title: "Content Studio",
      description: "Ubah insight riset jadi ide konten yang siap dieksekusi.",
      href: "/content-studio",
      icon: Sparkles,
      tileClass: "border-transparent bg-[#ffedcd] dark:bg-amber-400/10",
      capsuleClass: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
      lockedLabel: "Khusus tim studio & Market Analyst",
      stats: [
        { label: "ide konten", value: stats.contentIdeas },
        { label: "set ide siap", value: stats.contentIdeaSets },
      ],
      links: [{ label: "Ide Konten", href: "/content-studio/ideas" }],
    },
  ];
}

function ModuleTile({
  module,
  locked,
  variants,
}: {
  module: LabModule;
  locked: boolean;
  variants?: import("motion/react").Variants;
}) {
  const Icon = module.icon;

  return (
    <motion.article
      variants={variants}
      className={cn(
        "bento-tile group relative justify-start gap-0 p-6 sm:p-7",
        module.tileClass,
        locked && "opacity-70 saturate-50",
      )}
      aria-disabled={locked || undefined}
    >
      {/* Stretched link: seluruh tile bisa diklik tanpa <a> bersarang. */}
      {!locked ? (
        <Link
          href={module.href}
          aria-label={`Buka ${module.title}`}
          className="absolute inset-0 z-[1] rounded-[inherit]"
        />
      ) : null}

      <div className="relative flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <span
            className={cn(
              "flex size-12 shrink-0 items-center justify-center rounded-2xl",
              module.capsuleClass,
            )}
            aria-hidden
          >
            {locked ? <Lock className="size-5" /> : <Icon className="size-6" />}
          </span>
          <div className="min-w-0">
            <h2 className="text-lg font-bold tracking-tight">{module.title}</h2>
            <p className="text-muted-foreground mt-0.5 text-sm leading-relaxed">
              {module.description}
            </p>
          </div>
        </div>
        {!locked ? (
          <ArrowUpRight className="text-muted-foreground/50 size-5 shrink-0 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 motion-reduce:transition-none" />
        ) : null}
      </div>

      {locked ? (
        <div className="relative mt-6">
          <Tooltip>
            <TooltipTrigger className="bg-card text-muted-foreground inline-flex cursor-default items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium shadow-sm">
              <Lock className="size-3" />
              {module.lockedLabel}
            </TooltipTrigger>
            <TooltipContent>
              Modul ini tidak tersedia untuk peran kamu. Hubungi admin bila
              butuh akses.
            </TooltipContent>
          </Tooltip>
        </div>
      ) : (
        <>
          <div className="relative mt-6 flex flex-wrap gap-x-10 gap-y-3">
            {module.stats.map((stat) => (
              <div key={stat.label}>
                <div className="text-3xl font-extrabold tabular-nums tracking-tight">
                  <CountUp value={stat.value} />
                </div>
                <div className="text-muted-foreground mt-0.5 text-xs font-medium">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>

          <div className="relative z-10 mt-6 flex flex-wrap gap-2">
            {module.links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="bg-card text-foreground inline-flex items-center rounded-full px-3.5 py-1.5 text-xs font-semibold shadow-sm transition-transform hover:-translate-y-0.5 motion-reduce:hover:translate-y-0"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </>
      )}
    </motion.article>
  );
}

const WORKFLOW_STEPS = [
  "Riset pasar",
  "Strategi brand",
  "Produksi konten",
  "Optimasi SEO",
] as const;

export function DominatusLabClient({
  userName,
  access,
  stats,
}: {
  userName: string | null;
  access: LabAccess;
  stats: LabStats;
}) {
  const reduce = useReducedMotion();
  const modules = buildModules(stats);
  const firstName = userName?.split(" ")[0] ?? null;

  const containerVariants = {
    hidden: {},
    show: {
      transition: { staggerChildren: reduce ? 0 : 0.07, delayChildren: 0.05 },
    },
  };
  const itemVariants = reduce
    ? {
        hidden: { opacity: 0 },
        show: { opacity: 1, transition: { duration: 0.3 } },
      }
    : {
        hidden: { opacity: 0, y: 4 },
        show: {
          opacity: 1,
          y: 0,
          transition: { type: "spring" as const, stiffness: 160, damping: 22 },
        },
      };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="mx-auto flex w-full max-w-6xl flex-1 flex-col pb-14 pt-6 sm:pt-10"
    >
      {/* Hero */}
      <motion.div variants={itemVariants}>
        <span className="bg-card text-muted-foreground inline-flex items-center gap-2.5 rounded-full px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] shadow-sm">
          <span className="lab-pulse relative size-1.5 rounded-full" />
          <FlaskConical className="size-3.5" />
          Dominatus Lab
        </span>
      </motion.div>

      <motion.h1
        variants={itemVariants}
        className="text-foreground mt-6 max-w-2xl text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl"
      >
        Satu pintu untuk semua{" "}
        <span className="text-primary">riset &amp; kreativitas</span>.
      </motion.h1>

      <motion.p
        variants={itemVariants}
        className="text-muted-foreground mt-4 max-w-xl text-base leading-relaxed"
      >
        {firstName ? `Halo ${firstName} — ` : ""}pilih laboratorium di bawah
        untuk mulai bekerja. Semua angka tersinkron langsung dari modulnya.
      </motion.p>

      {/* Alur kerja */}
      <motion.div
        variants={itemVariants}
        className="text-muted-foreground mt-6 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs font-medium"
      >
        {WORKFLOW_STEPS.map((step, index) => (
          <span key={step} className="inline-flex items-center gap-2">
            <span className="bg-card rounded-full px-2.5 py-1 shadow-sm">
              {step}
            </span>
            {index < WORKFLOW_STEPS.length - 1 ? (
              <ChevronRight className="text-muted-foreground/50 size-3.5" />
            ) : null}
          </span>
        ))}
      </motion.div>

      {/* Tile modul */}
      <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2">
        {modules.map((module) => (
          <ModuleTile
            key={module.key}
            module={module}
            locked={!access[module.key]}
            variants={itemVariants}
          />
        ))}
      </div>

      <motion.p
        variants={itemVariants}
        className="text-muted-foreground/70 mt-10 text-center text-xs"
      >
        Dominatus Lab · pusat riset &amp; kreatif DCC — data diperbarui setiap
        kali halaman dibuka.
      </motion.p>
    </motion.div>
  );
}
