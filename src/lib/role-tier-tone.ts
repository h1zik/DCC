import { UserRole } from "@prisma/client";
import { permissionTierLabel } from "@/lib/role-labels";

export type TierTone = {
  /** Titik kecil berwarna (mis. di dalam chip). */
  dot: string;
  /** Chip/badge penuh: border + latar + teks. */
  chip: string;
  /** Tile ikon: latar + teks. */
  iconTile: string;
  /** Bar horizontal (progress) berwarna solid. */
  bar: string;
};

const TONES: Record<string, TierTone> = {
  amber: {
    dot: "bg-amber-500",
    chip: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    iconTile: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
    bar: "bg-amber-500",
  },
  sky: {
    dot: "bg-sky-500",
    chip: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
    iconTile: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
    bar: "bg-sky-500",
  },
  emerald: {
    dot: "bg-emerald-500",
    chip: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    iconTile: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    bar: "bg-emerald-500",
  },
  violet: {
    dot: "bg-violet-500",
    chip: "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300",
    iconTile: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
    bar: "bg-violet-500",
  },
  teal: {
    dot: "bg-teal-500",
    chip: "border-teal-500/30 bg-teal-500/10 text-teal-700 dark:text-teal-300",
    iconTile: "bg-teal-500/10 text-teal-700 dark:text-teal-300",
    bar: "bg-teal-500",
  },
  indigo: {
    dot: "bg-indigo-500",
    chip: "border-indigo-500/30 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",
    iconTile: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",
    bar: "bg-indigo-500",
  },
  slate: {
    dot: "bg-slate-400",
    chip: "border-border bg-muted/60 text-muted-foreground",
    iconTile: "bg-muted text-muted-foreground",
    bar: "bg-slate-400",
  },
};

/** Skema warna per tier permission, konsisten dengan chip di hero Pengguna. */
export function tierTone(tier: UserRole): TierTone {
  switch (tier) {
    case UserRole.CEO:
      return TONES.amber;
    case UserRole.ADMINISTRATOR:
      return TONES.sky;
    case UserRole.FINANCE:
      return TONES.emerald;
    case UserRole.MARKET_ANALYST:
      return TONES.violet;
    case UserRole.LOGISTICS:
      return TONES.teal;
    case UserRole.PROJECT_MANAGER:
      return TONES.indigo;
    default:
      return TONES.slate;
  }
}

/**
 * Deskripsi singkat tier: bagian dalam tanda kurung dari
 * `permissionTierLabel` (mis. "akses modul keuangan").
 */
export function tierDescription(tier: UserRole): string {
  const match = permissionTierLabel(tier).match(/\(([^)]+)\)/);
  return match?.[1] ?? "";
}
