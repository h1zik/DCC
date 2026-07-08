import { createElement } from "react";
import Link from "next/link";
import {
  Award,
  CalendarCheck,
  CalendarHeart,
  CircleCheckBig,
  Crown,
  DatabaseZap,
  Flame,
  Gauge,
  Lock,
  Moon,
  Siren,
  Sparkles,
  TrendingUp,
  Trophy,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import type { AchievementView } from "@/lib/gamification/profile-view";
import { cn } from "@/lib/utils";

/**
 * Visual achievement ala Steam. Tier = "material" (bronze→platinum) memakai kelas
 * palet Tailwind yang SUDAH di-remap per tema (theme-palettes.css) → tetap ikut
 * tema. Foil shine muncul saat hover (CSS murni, transform/opacity — GPU-friendly).
 */

const ICONS: Record<string, LucideIcon> = {
  CalendarCheck,
  CalendarHeart,
  Flame,
  CircleCheckBig,
  Gauge,
  Sparkles,
  Siren,
  DatabaseZap,
  Crown,
  TrendingUp,
  Moon,
  Undo2,
  Lock,
  Trophy,
};

function iconFor(name: string): LucideIcon {
  return ICONS[name] ?? Award;
}

/** Render ikon dinamis via createElement (hindari komponen di dalam render). */
function renderIcon(name: string, className: string) {
  return createElement(iconFor(name), { className, "aria-hidden": true });
}

type TierStyle = { ring: string; medal: string; text: string; label: string };

const TIER_STYLE: Record<string, TierStyle> = {
  BRONZE: {
    ring: "ring-amber-700/40",
    medal: "from-amber-600/30 to-orange-800/20 text-amber-600",
    text: "text-amber-700 dark:text-amber-400",
    label: "Bronze",
  },
  SILVER: {
    ring: "ring-slate-400/40",
    medal: "from-slate-300/40 to-slate-500/20 text-slate-500",
    text: "text-slate-600 dark:text-slate-300",
    label: "Silver",
  },
  GOLD: {
    ring: "ring-yellow-500/50",
    medal: "from-yellow-400/40 to-amber-600/20 text-yellow-600",
    text: "text-yellow-700 dark:text-yellow-400",
    label: "Gold",
  },
  PLATINUM: {
    ring: "ring-cyan-400/50",
    medal: "from-cyan-300/40 to-violet-500/20 text-cyan-500",
    text: "text-cyan-600 dark:text-cyan-300",
    label: "Platinum",
  },
};

function tierStyle(tier: string): TierStyle {
  return TIER_STYLE[tier] ?? TIER_STYLE.BRONZE;
}

export function AchievementBadge({
  ach,
  className,
}: {
  ach: AchievementView;
  className?: string;
}) {
  const t = tierStyle(ach.tier);
  const unlocked = ach.unlocked;
  const pct =
    ach.threshold > 0
      ? Math.min(100, Math.round((ach.progress / ach.threshold) * 100))
      : 0;

  return (
    <div
      className={cn(
        "group border-border/70 bg-card relative flex flex-col items-center gap-2 overflow-hidden rounded-2xl border p-3 text-center shadow-sm transition-transform",
        unlocked ? "hover:-translate-y-0.5" : "opacity-70",
        className,
      )}
      title={`${ach.name} — ${ach.description}`}
    >
      {/* Foil shine on hover (unlocked only) */}
      {unlocked ? (
        <span
          className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-full"
          aria-hidden
        />
      ) : null}

      <div
        className={cn(
          "relative flex size-14 items-center justify-center rounded-full bg-gradient-to-br ring-2",
          t.medal,
          t.ring,
          !unlocked && "grayscale",
        )}
      >
        {renderIcon(ach.icon, "size-6")}
        {!unlocked ? (
          <span className="bg-background/70 text-muted-foreground absolute -bottom-1 -right-1 flex size-5 items-center justify-center rounded-full border border-border">
            <Lock className="size-3" aria-hidden />
          </span>
        ) : null}
      </div>

      <div className="min-w-0">
        <p className="text-foreground truncate text-xs font-semibold">{ach.name}</p>
        <p className={cn("text-[10px] font-medium uppercase tracking-wide", t.text)}>
          {t.label}
        </p>
      </div>

      {!unlocked && ach.threshold > 0 && !ach.hidden ? (
        <div className="w-full">
          <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
            <div
              className="h-full rounded-full bg-primary/60"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-muted-foreground mt-0.5 text-[10px] tabular-nums">
            {ach.progress}/{ach.threshold}
          </p>
        </div>
      ) : null}
    </div>
  );
}

export function AchievementShowcase({ items }: { items: AchievementView[] }) {
  if (items.length === 0) return null;
  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
      {items.map((a) => (
        <AchievementBadge key={a.key} ach={a} />
      ))}
    </div>
  );
}

export function AchievementShelf({
  achievements,
  unlockedCount,
  totalCount,
  galleryHref,
}: {
  achievements: AchievementView[];
  unlockedCount: number;
  totalCount: number;
  galleryHref: string;
}) {
  const recent = achievements
    .filter((a) => a.unlocked)
    .sort((a, b) => (b.unlockedAt ?? "").localeCompare(a.unlockedAt ?? ""))
    .slice(0, 8);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground text-xs tabular-nums">
          {unlockedCount}/{totalCount} pencapaian terbuka
        </span>
        <Link
          href={galleryHref}
          className="text-accent-foreground text-xs font-medium hover:underline"
        >
          Lihat galeri →
        </Link>
      </div>
      {recent.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {recent.map((a) => {
            const t = tierStyle(a.tier);
            return (
              <span
                key={a.key}
                className={cn(
                  "flex size-10 items-center justify-center rounded-full bg-gradient-to-br ring-2",
                  t.medal,
                  t.ring,
                )}
                title={a.name}
              >
                {renderIcon(a.icon, "size-4")}
              </span>
            );
          })}
        </div>
      ) : (
        <p className="text-muted-foreground text-sm italic">
          Belum ada pencapaian. Mulai check-in & selesaikan tugas tepat waktu!
        </p>
      )}
    </div>
  );
}
