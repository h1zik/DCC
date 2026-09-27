/**
 * Rekomendasi rate card — fungsi murni.
 *
 * Fair price = median views ÷ 1000 × CPM acuan (per tier & platform).
 * Band: floor% & ceiling% dari fair price. Rate di bawah floor = Good deal,
 * di atas ceiling = Overpriced. Ini acuan negosiasi internal, bukan penilaian
 * kualitas KOL.
 */

export type RateVerdict = "GOOD_DEAL" | "FAIR" | "OVERPRICED";

export type RateBand = {
  fair: number;
  floor: number;
  ceiling: number;
};

export const RATE_VERDICT_META: Record<
  RateVerdict,
  { label: string; tone: "success" | "info" | "danger"; hint: string }
> = {
  GOOD_DEAL: {
    label: "Good deal",
    tone: "success",
    hint: "Di bawah batas bawah harga wajar — hemat dibanding performa views-nya.",
  },
  FAIR: { label: "Wajar", tone: "info", hint: "Dalam rentang harga wajar." },
  OVERPRICED: {
    label: "Kemahalan",
    tone: "danger",
    hint: "Di atas batas atas harga wajar — pertimbangkan negosiasi.",
  },
};

/** Default pasar Indonesia (GroovingWave) + tier Mid khas DCC. */
export const DEFAULT_REFERENCE_CPM: Record<
  "INSTAGRAM" | "TIKTOK",
  Record<"NANO" | "MICRO" | "MID" | "MACRO" | "MEGA", number>
> = {
  TIKTOK: { NANO: 10_000, MICRO: 15_000, MID: 17_500, MACRO: 20_000, MEGA: 28_000 },
  INSTAGRAM: { NANO: 25_000, MICRO: 30_000, MID: 35_000, MACRO: 40_000, MEGA: 55_000 },
};

export const DEFAULT_PLATFORM_CONFIG = {
  floorPct: 80,
  ceilingPct: 120,
  fypThreshold: 1_000_000,
  trackingDays: 30,
};

/** Bulatkan ke ribuan terdekat — angka rate card memang dinegosiasikan per ribuan. */
function roundThousand(n: number): number {
  return Math.round(n / 1000) * 1000;
}

export function computeRateBand(
  medianViews: number,
  referenceCpm: number,
  floorPct: number,
  ceilingPct: number,
): RateBand | null {
  if (!medianViews || medianViews <= 0 || !referenceCpm) return null;
  const fair = (medianViews / 1000) * referenceCpm;
  return {
    fair: roundThousand(fair),
    floor: roundThousand((fair * floorPct) / 100),
    ceiling: roundThousand((fair * ceilingPct) / 100),
  };
}

export function rateVerdict(rate: number, band: RateBand): RateVerdict {
  if (rate < band.floor) return "GOOD_DEAL";
  if (rate > band.ceiling) return "OVERPRICED";
  return "FAIR";
}
