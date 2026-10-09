"use client";

import { useState } from "react";
import { Columns3, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  compactNumber,
  InfluencerAvatar,
  LegacyMethodBadge,
  ReliabilityMeter,
  ScoreRangeBar,
  TIER_LABEL,
  VerdictBadge,
} from "@/components/brand-hub/influencer-badges";
import { cn } from "@/lib/utils";
import type { InfluencerRow } from "./influencer-audit-client";
import { erRatio, pctText } from "./influencer-list-views";

export const MAX_COMPARE = 4;

type CompareRow = {
  label: string;
  hint?: string;
  /** Nilai pembanding; null = tidak ikut ditandai terbaik. */
  value: (r: InfluencerRow) => number | null;
  /** "high" = makin besar makin baik. */
  better?: "high" | "low";
  render: (r: InfluencerRow) => React.ReactNode;
};

const ROWS: CompareRow[] = [
  {
    label: "Skor",
    value: (r) => r.score,
    better: "high",
    render: (r) =>
      r.score !== null ? (
        <div className="flex flex-col gap-1">
          <span className="text-foreground text-lg font-bold tabular-nums">{r.score}</span>
          <ScoreRangeBar score={r.score} interval={r.scoreInterval} verdict={r.verdict} />
          <span className="text-muted-foreground text-[11px] tabular-nums">
            {r.scoreInterval ? `rentang ${r.scoreInterval[0]}–${r.scoreInterval[1]}` : "tanpa rentang"}
          </span>
        </div>
      ) : (
        "—"
      ),
  },
  {
    // Batas bawah rentang = skor yang hampir pasti tercapai. Untuk memilih
    // dengan uang sungguhan, ini angka yang lebih jujur daripada titiknya.
    label: "Skor terburuk yang wajar",
    hint: "Batas bawah rentang",
    value: (r) => r.scoreInterval?.[0] ?? null,
    better: "high",
    render: (r) => (r.scoreInterval ? r.scoreInterval[0] : "—"),
  },
  {
    label: "Keandalan data",
    value: (r) => r.reliability,
    better: "high",
    render: (r) =>
      r.scoringVersion === 1 ? <LegacyMethodBadge /> : <ReliabilityMeter value={r.reliability} />,
  },
  {
    label: "ER",
    hint: "Like + komentar ÷ follower",
    value: (r) => erRatio(r),
    better: "high",
    render: (r) => {
      const ratio = erRatio(r);
      return (
        <span>
          {pctText(r.engagementRate)}
          {ratio !== null ? (
            <span className="text-muted-foreground"> ({ratio.toFixed(1)}× median)</span>
          ) : null}
        </span>
      );
    },
  },
  {
    label: "Posisi di antara akun sekelas",
    value: (r) => r.peerPercentile,
    better: "high",
    render: (r) =>
      r.peerPercentile !== null ? `di atas ${r.peerPercentile}%` : "Pembanding belum cukup",
  },
  {
    label: "Perkiraan ER campaign",
    value: (r) => r.expectedCampaignEr,
    better: "high",
    render: (r) => pctText(r.expectedCampaignEr),
  },
  {
    label: "Follower",
    value: () => null,
    render: (r) =>
      r.followers !== null
        ? `${compactNumber(r.followers)}${r.tier ? `, ${TIER_LABEL[r.tier]}` : ""}`
        : "—",
  },
  {
    label: "Sinyal temuan",
    value: (r) => r.flagCount,
    better: "low",
    render: (r) => (r.flagCount > 0 ? `${r.flagCount} sinyal` : "Tidak ada"),
  },
  {
    label: "Vonis",
    value: () => null,
    render: (r) => <VerdictBadge verdict={r.verdict} />,
  },
];

function bestIds(rows: InfluencerRow[], spec: CompareRow): Set<string> {
  if (!spec.better) return new Set();
  const scored = rows
    .map((r) => ({ id: r.id, v: spec.value(r) }))
    .filter((x): x is { id: string; v: number } => x.v !== null);
  // Tanda "terbaik" hanya bermakna bila ada yang dibandingkan dan nilainya
  // tidak sama semua.
  if (scored.length < 2) return new Set();
  const target =
    spec.better === "high"
      ? Math.max(...scored.map((x) => x.v))
      : Math.min(...scored.map((x) => x.v));
  if (scored.every((x) => x.v === target)) return new Set();
  return new Set(scored.filter((x) => x.v === target).map((x) => x.id));
}

export function CompareTray({
  rows,
  onRemove,
  onClear,
}: {
  rows: InfluencerRow[];
  onRemove: (id: string) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  if (rows.length === 0) return null;

  return (
    <>
      <div
        role="region"
        aria-label="Influencer yang dipilih untuk dibandingkan"
        className="border-border bg-popover/95 sticky bottom-4 z-30 mx-auto flex w-full max-w-3xl flex-wrap items-center gap-3 rounded-2xl border p-3 shadow-lg backdrop-blur"
      >
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          {rows.map((r) => (
            <span
              key={r.id}
              className="bg-muted text-foreground inline-flex items-center gap-1.5 rounded-full py-0.5 pr-1 pl-0.5 text-xs font-medium"
            >
              <InfluencerAvatar src={r.avatarUrl} handle={r.handle} className="size-5 text-[9px]" />
              @{r.handle}
              <button
                type="button"
                onClick={() => onRemove(r.id)}
                className="hover:bg-background focus-visible:ring-ring/50 rounded-full p-0.5 outline-none focus-visible:ring-2"
                aria-label={`Keluarkan @${r.handle} dari perbandingan`}
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
          {rows.length < 2 ? (
            <span className="text-muted-foreground text-xs">
              Pilih satu lagi untuk membandingkan
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={onClear}>
            Batal
          </Button>
          <Button
            size="sm"
            className="gap-1.5"
            disabled={rows.length < 2}
            onClick={() => setOpen(true)}
          >
            <Columns3 className="size-4" />
            Bandingkan {rows.length}
          </Button>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Bandingkan {rows.length} influencer</DialogTitle>
            <DialogDescription>
              Nilai terbaik di tiap baris ditebalkan. Utamakan skor terburuk
              yang wajar dan keandalannya, bukan hanya skor tertinggi.
            </DialogDescription>
          </DialogHeader>

          <div className="-mx-1 overflow-x-auto px-1">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr>
                  <th scope="col" className="w-44 py-2 pr-3 text-left">
                    <span className="sr-only">Metrik</span>
                  </th>
                  {rows.map((r) => (
                    <th key={r.id} scope="col" className="py-2 pr-3 text-left align-bottom">
                      <div className="flex items-center gap-2">
                        <InfluencerAvatar src={r.avatarUrl} handle={r.handle} className="size-7 text-[10px]" />
                        <span className="text-foreground truncate text-sm font-semibold">
                          @{r.handle}
                        </span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROWS.map((spec) => {
                  const best = bestIds(rows, spec);
                  return (
                    <tr key={spec.label} className="border-border/60 border-t align-top">
                      <th scope="row" className="py-3 pr-3 text-left font-normal">
                        <p className="text-foreground text-xs font-medium">{spec.label}</p>
                        {spec.hint ? (
                          <p className="text-muted-foreground text-[11px]">{spec.hint}</p>
                        ) : null}
                      </th>
                      {rows.map((r) => (
                        <td
                          key={r.id}
                          className={cn(
                            "text-muted-foreground py-3 pr-3 tabular-nums",
                            best.has(r.id) && "text-foreground font-semibold",
                          )}
                        >
                          {spec.render(r)}
                          {best.has(r.id) ? <span className="sr-only"> (terbaik)</span> : null}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
