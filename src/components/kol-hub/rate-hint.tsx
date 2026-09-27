"use client";

import { compactNumber } from "@/components/brand-hub/influencer-badges";
import { KolBadge } from "@/components/kol-hub/kol-badges";
import { rupiahShort } from "@/lib/kol/format";
import { RATE_VERDICT_META, rateVerdict, type RateBand } from "@/lib/kol/rate-card";
import { cn } from "@/lib/utils";

export type RateHintData = {
  band: RateBand | null;
  medianViews: number | null;
  tier: string | null;
};

/**
 * Rekomendasi rate: harga wajar + rentang, verdict untuk rate yang sedang
 * diisi, dan tombol untuk memakainya. Tanpa median views → ajakan audit.
 */
export function RateHint({
  data,
  rate,
  onApply,
  className,
}: {
  data: RateHintData | undefined;
  rate?: number | null;
  onApply?: (fair: number) => void;
  className?: string;
}) {
  if (!data?.band) {
    return (
      <p className={cn("text-muted-foreground text-[11px]", className)}>
        Harga wajar belum bisa dihitung — jalankan audit akun ini dulu untuk mendapat median views.
      </p>
    );
  }
  const { band } = data;
  const verdict = rate && rate > 0 ? rateVerdict(rate, band) : null;
  return (
    <div className={cn("flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]", className)}>
      <span className="text-muted-foreground">
        Harga wajar <span className="text-foreground font-semibold">{rupiahShort(band.fair)}</span>{" "}
        ({rupiahShort(band.floor)}–{rupiahShort(band.ceiling)})
        {data.medianViews ? ` dari median ${compactNumber(data.medianViews)} views` : ""}
      </span>
      {verdict ? (
        <KolBadge tone={RATE_VERDICT_META[verdict].tone} title={RATE_VERDICT_META[verdict].hint}>
          {RATE_VERDICT_META[verdict].label}
        </KolBadge>
      ) : null}
      {onApply && rate !== band.fair ? (
        <button
          type="button"
          onClick={() => onApply(band.fair)}
          className="font-medium text-[var(--lab-accent,var(--primary))] hover:underline"
        >
          Pakai harga wajar
        </button>
      ) : null}
    </div>
  );
}
