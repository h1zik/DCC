"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { BadgeCheck, RefreshCw, ShieldAlert, Trash2, TrendingDown } from "lucide-react";
import { InfluencerAuditStatus } from "@prisma/client";
import { toast } from "sonner";
import {
  deleteInfluencerProfile,
  reauditInfluencer,
} from "@/actions/brand-influencer";
import { actionErrorMessage } from "@/lib/action-error-message";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AuditStatusPill,
  compactNumber,
  InfluencerAvatar,
  isAuditInProgress,
  LegacyMethodBadge,
  PLATFORM_LABEL,
  ReliabilityMeter,
  ScoreRangeBar,
  TIER_LABEL,
  VerdictBadge,
} from "@/components/brand-hub/influencer-badges";
import { cn } from "@/lib/utils";
import type { InfluencerRow } from "./influencer-audit-client";

export function pctText(value: number | null, digits = 2): string {
  if (value === null) return "—";
  return `${value.toLocaleString("id-ID", { maximumFractionDigits: digits })}%`;
}

export function erRatio(row: InfluencerRow): number | null {
  return row.engagementRate !== null && row.benchmarkEr
    ? row.engagementRate / row.benchmarkEr
    : null;
}

/** "p72" terbaca janggal; kalimat pendek lebih jelas bagi non-analis. */
export function peerText(percentile: number | null): string | null {
  if (percentile === null) return null;
  return `di atas ${percentile}% akun sekelas`;
}

function useRowActions(row: InfluencerRow, onChanged: () => void) {
  const [pending, startTransition] = useTransition();

  function reaudit() {
    startTransition(async () => {
      try {
        await reauditInfluencer(row.id);
        toast.success(`Audit ulang @${row.handle} dijalankan.`);
        onChanged();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal menjalankan audit ulang."));
      }
    });
  }

  function remove() {
    startTransition(async () => {
      try {
        await deleteInfluencerProfile(row.id);
        toast.success(`@${row.handle} dihapus.`);
        onChanged();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal menghapus influencer."));
      }
    });
  }

  return { pending, reaudit, remove };
}

function RowActions({
  row,
  onChanged,
}: {
  row: InfluencerRow;
  onChanged: () => void;
}) {
  const { pending, reaudit, remove } = useRowActions(row, onChanged);
  const running = isAuditInProgress(row.latestStatus);
  const failed = row.latestStatus === InfluencerAuditStatus.FAILED;

  return (
    <div
      className="flex items-center justify-end gap-0.5"
      onClick={(e) => e.stopPropagation()}
    >
      <Button
        variant="ghost"
        size="sm"
        onClick={reaudit}
        disabled={pending || running}
        title={failed ? "Coba audit lagi" : "Audit ulang"}
        className="text-muted-foreground hover:text-foreground h-8 px-2"
      >
        <RefreshCw className={cn("size-3.5", pending && "animate-spin")} />
        <span className="sr-only">{failed ? "Coba lagi" : "Audit ulang"}</span>
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={remove}
        disabled={pending || running}
        title="Hapus dari daftar"
        className="text-muted-foreground hover:text-destructive h-8 px-2"
      >
        <Trash2 className="size-3.5" />
        <span className="sr-only">Hapus @{row.handle}</span>
      </Button>
    </div>
  );
}

/** Peringatan yang harus terbaca dari daftar — bukan baru setelah dibuka. */
function RowWarnings({ row }: { row: InfluencerRow }) {
  const paidDrop =
    row.sponsoredDeltaPct !== null && row.sponsoredDeltaPct < -20
      ? Math.abs(row.sponsoredDeltaPct)
      : null;
  if (!row.severeRisk && paidDrop === null) return null;

  return (
    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] font-medium">
      {row.severeRisk ? (
        <span className="inline-flex items-center gap-1 text-[var(--iv-fraud)]">
          <ShieldAlert className="size-3" aria-hidden />
          {row.severeRisk}
        </span>
      ) : null}
      {paidDrop !== null ? (
        <span className="inline-flex items-center gap-1 text-[var(--iv-review)]">
          <TrendingDown className="size-3" aria-hidden />
          Post berbayar {paidDrop.toFixed(0)}% lebih sepi
        </span>
      ) : null}
    </div>
  );
}

function Identity({
  row,
  href,
}: {
  row: InfluencerRow;
  href: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <InfluencerAvatar
        src={row.avatarUrl}
        handle={row.handle}
        className="size-9 text-xs"
      />
      <div className="min-w-0">
        <Link
          href={href}
          onClick={(e) => e.stopPropagation()}
          className="text-foreground focus-visible:ring-ring/50 flex items-center gap-1 truncate rounded-sm text-sm font-semibold outline-none hover:underline focus-visible:ring-2"
        >
          @{row.handle}
          {row.isVerified ? (
            <BadgeCheck className="size-3.5 shrink-0 text-sky-500" aria-label="Terverifikasi" />
          ) : null}
        </Link>
        <p className="text-muted-foreground truncate text-xs">
          {PLATFORM_LABEL[row.platform]}
          {row.tier ? `, ${TIER_LABEL[row.tier]}` : ""}
          {row.followers !== null
            ? `, ${compactNumber(row.followers)} follower`
            : ""}
        </p>
      </div>
    </div>
  );
}

function ScoreCell({ row }: { row: InfluencerRow }) {
  if (row.latestStatus !== InfluencerAuditStatus.READY || row.score === null) {
    return (
      <div className="flex flex-col gap-1">
        <AuditStatusPill status={row.latestStatus} />
        {row.latestStatus === InfluencerAuditStatus.FAILED && row.errorMessage ? (
          <p
            className="text-muted-foreground line-clamp-2 max-w-[260px] text-[11px] leading-snug"
            title={row.errorMessage}
          >
            {row.errorMessage}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex min-w-[180px] items-center gap-3">
      <span className="text-foreground w-7 text-right text-lg font-bold tabular-nums tracking-tight">
        {row.score}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <ScoreRangeBar
          score={row.score}
          interval={row.scoreInterval}
          verdict={row.verdict}
        />
        <span className="text-muted-foreground text-[11px] tabular-nums">
          {row.scoreInterval
            ? `rentang ${row.scoreInterval[0]}–${row.scoreInterval[1]}`
            : row.scoringVersion === 1
              ? "tanpa rentang"
              : " "}
        </span>
      </div>
    </div>
  );
}

export function InfluencerTable({
  rows,
  hrefFor,
  selected,
  onToggle,
  selectionFull,
  onChanged,
}: {
  rows: InfluencerRow[];
  hrefFor: (row: InfluencerRow) => string;
  selected: Set<string>;
  onToggle: (id: string) => void;
  selectionFull: boolean;
  onChanged: () => void;
}) {
  const router = useRouter();

  return (
    <div className="border-border/70 bg-card/60 hidden overflow-x-auto rounded-2xl border md:block">
      <table className="w-full min-w-[900px] text-sm">
        <caption className="sr-only">
          Influencer yang diaudit beserta skor, rentang, keandalan, dan vonisnya
        </caption>
        <thead className="bg-card/95 sticky top-0 z-10 backdrop-blur">
          <tr className="text-muted-foreground border-border/70 border-b text-left text-xs font-medium">
            <th scope="col" className="w-10 py-3 pl-4">
              <span className="sr-only">Pilih untuk dibandingkan</span>
            </th>
            <th scope="col" className="py-3 pr-4">Influencer</th>
            <th scope="col" className="py-3 pr-4">Skor</th>
            <th scope="col" className="py-3 pr-4">Keandalan</th>
            <th scope="col" className="py-3 pr-4 text-right">ER</th>
            <th scope="col" className="py-3 pr-4 text-right">Perkiraan campaign</th>
            <th scope="col" className="py-3 pr-4">Vonis</th>
            <th scope="col" className="py-3 pr-3">
              <span className="sr-only">Tindakan</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const ready = row.latestStatus === InfluencerAuditStatus.READY;
            const ratio = erRatio(row);
            const isSelected = selected.has(row.id);
            return (
              <tr
                key={row.id}
                onClick={() => router.push(hrefFor(row))}
                className={cn(
                  "border-border/50 hover:bg-muted/30 cursor-pointer border-b align-middle transition-colors last:border-b-0",
                  isSelected && "bg-muted/40",
                )}
              >
                <td className="py-3 pl-4" onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={isSelected}
                    disabled={!ready || (selectionFull && !isSelected)}
                    onCheckedChange={() => onToggle(row.id)}
                    aria-label={`Bandingkan @${row.handle}`}
                  />
                </td>
                <td className="max-w-[280px] py-3 pr-4">
                  <Identity row={row} href={hrefFor(row)} />
                  <RowWarnings row={row} />
                </td>
                <td className="py-3 pr-4">
                  <ScoreCell row={row} />
                </td>
                <td className="py-3 pr-4">
                  {ready ? (
                    row.scoringVersion === 1 ? (
                      <LegacyMethodBadge />
                    ) : (
                      <ReliabilityMeter value={row.reliability} />
                    )
                  ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                  )}
                </td>
                <td className="py-3 pr-4 text-right">
                  {ready ? (
                    <>
                      <p className="text-foreground font-semibold tabular-nums">
                        {pctText(row.engagementRate)}
                      </p>
                      <p className="text-muted-foreground text-[11px] tabular-nums">
                        {peerText(row.peerPercentile) ??
                          (ratio !== null ? `${ratio.toFixed(1)}× median tier` : "")}
                      </p>
                    </>
                  ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                  )}
                </td>
                <td className="text-foreground py-3 pr-4 text-right tabular-nums">
                  {ready ? pctText(row.expectedCampaignEr) : "—"}
                </td>
                <td className="py-3 pr-4">
                  <div className="flex flex-col items-start gap-1">
                    <VerdictBadge verdict={ready ? row.verdict : null} />
                    {ready && row.flagCount > 0 ? (
                      <span className="text-muted-foreground text-[11px]">
                        {row.flagCount} sinyal
                      </span>
                    ) : null}
                  </div>
                </td>
                <td className="py-3 pr-3">
                  <RowActions row={row} onChanged={onChanged} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Tampilan ponsel: satu kartu ringkas per influencer, batang skor yang sama. */
export function InfluencerCompactList({
  rows,
  hrefFor,
  selected,
  onToggle,
  selectionFull,
  onChanged,
}: {
  rows: InfluencerRow[];
  hrefFor: (row: InfluencerRow) => string;
  selected: Set<string>;
  onToggle: (id: string) => void;
  selectionFull: boolean;
  onChanged: () => void;
}) {
  return (
    <ul className="flex flex-col gap-2 md:hidden">
      {rows.map((row) => {
        const ready = row.latestStatus === InfluencerAuditStatus.READY;
        const isSelected = selected.has(row.id);
        return (
          <li
            key={row.id}
            className={cn(
              "border-border/70 bg-card/60 rounded-2xl border p-4",
              isSelected && "border-foreground/30",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <Identity row={row} href={hrefFor(row)} />
              <VerdictBadge verdict={ready ? row.verdict : null} />
            </div>
            <RowWarnings row={row} />

            <div className="mt-3">
              <ScoreCell row={row} />
            </div>

            {ready ? (
              <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
                <div>
                  <dt className="text-muted-foreground">Keandalan</dt>
                  <dd className="mt-0.5">
                    {row.scoringVersion === 1 ? (
                      <LegacyMethodBadge />
                    ) : (
                      <ReliabilityMeter value={row.reliability} />
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">ER</dt>
                  <dd className="text-foreground mt-0.5 font-semibold tabular-nums">
                    {pctText(row.engagementRate)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Campaign</dt>
                  <dd className="text-foreground mt-0.5 font-semibold tabular-nums">
                    {pctText(row.expectedCampaignEr)}
                  </dd>
                </div>
              </dl>
            ) : null}

            <div className="border-border/50 mt-3 flex items-center justify-between border-t pt-2">
              <label className="text-muted-foreground flex items-center gap-2 text-xs">
                <Checkbox
                  checked={isSelected}
                  disabled={!ready || (selectionFull && !isSelected)}
                  onCheckedChange={() => onToggle(row.id)}
                />
                Bandingkan
              </label>
              <RowActions row={row} onChanged={onChanged} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
