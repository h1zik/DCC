"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { compactNumber } from "@/components/brand-hub/influencer-badges";
import { PlatformMark, ScheduleStatusStack } from "@/components/kol-hub/kol-badges";
import { LabCard } from "@/components/lab/lab-primitives";
import { rupiahShort } from "@/lib/kol/format";
import { cpm } from "@/lib/kol/metrics";
import { OBJECTIVE_META, PLACEMENT_LABEL } from "@/lib/kol/labels";
import type { ScheduleRow } from "@/lib/kol/readers";
import { formatWibDate, formatWibTime } from "@/lib/kol/time";
import { cn } from "@/lib/utils";

/** Tabel jadwal ringkas — dipakai halaman Jadwal & detail Campaign. */
export function ScheduleTable({
  rows,
  hideCampaign,
  dimmed,
}: {
  rows: ScheduleRow[];
  hideCampaign?: boolean;
  dimmed?: boolean;
}) {
  const router = useRouter();
  return (
    <LabCard className={cn("overflow-x-auto p-0", dimmed && "opacity-70")}>
      <table className="w-full min-w-[1040px] text-sm">
        <thead>
          <tr className="text-muted-foreground border-b border-border/70 text-left text-[11px]">
            <th className="px-4 py-2.5 font-medium">Tayang (WIB)</th>
            <th className="px-3 py-2.5 font-medium">KOL</th>
            <th className="px-3 py-2.5 font-medium">Konten</th>
            {hideCampaign ? null : <th className="px-3 py-2.5 font-medium">Campaign</th>}
            <th className="px-3 py-2.5 text-right font-medium">Biaya</th>
            <th className="px-3 py-2.5 text-right font-medium">Views</th>
            <th className="px-3 py-2.5 text-right font-medium">CPM</th>
            <th className="px-3 py-2.5 font-medium">PIC</th>
            <th className="px-4 py-2.5 font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50">
          {rows.map((s) => (
            <tr
              key={s.id}
              className="hover:bg-muted/40 cursor-pointer align-top transition-colors"
              onClick={() => router.push(`/kol-hub/schedules/${s.id}`)}
            >
              <td className="px-4 py-3 whitespace-nowrap">
                {s.scheduledAt ? (
                  <>
                    <p className="font-medium">{formatWibDate(s.scheduledAt)}</p>
                    <p className="text-muted-foreground text-xs tabular-nums">
                      {formatWibTime(s.scheduledAt)}
                    </p>
                  </>
                ) : (
                  <p className="text-muted-foreground text-xs">Belum diisi</p>
                )}
                <Link
                  href={`/kol-hub/schedules/${s.id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="text-muted-foreground text-[11px] hover:underline"
                >
                  {s.subNumber}
                </Link>
              </td>
              <td className="px-3 py-3">
                <p className="font-medium">{s.kolName}</p>
                <p className="text-muted-foreground flex items-center gap-1 text-xs">
                  <PlatformMark platform={s.platform} className="size-4 text-[8px]" />@{s.handle}
                  {s.followers != null ? ` · ${compactNumber(s.followers)}` : ""}
                </p>
              </td>
              <td className="px-3 py-3 text-xs">
                <p className="text-foreground text-sm">{PLACEMENT_LABEL[s.placement]}</p>
                <p className="text-muted-foreground">
                  {OBJECTIVE_META[s.objective].label} · {s.endorseType}
                </p>
              </td>
              {hideCampaign ? null : (
                <td className="px-3 py-3">
                  <p className="max-w-[220px] truncate">{s.campaignTitle}</p>
                  <p className="text-muted-foreground text-xs">{s.brandName}</p>
                </td>
              )}
              <td className="px-3 py-3 text-right tabular-nums">
                {rupiahShort(s.rate + s.additionalCost)}
                {s.isBarter ? (
                  <p className="text-muted-foreground text-[11px]">Barter</p>
                ) : null}
              </td>
              <td className="px-3 py-3 text-right tabular-nums">
                {s.latestViews != null ? compactNumber(s.latestViews) : "—"}
                {s.isFyp ? (
                  <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">FYP</p>
                ) : null}
              </td>
              <td className="px-3 py-3 text-right tabular-nums">
                {(() => {
                  const v = cpm(s.rate + s.additionalCost, s.latestViews);
                  return v != null ? rupiahShort(v) : "—";
                })()}
              </td>
              <td className="text-muted-foreground px-3 py-3 text-xs">{s.picName ?? "—"}</td>
              <td className="px-4 py-3">
                <ScheduleStatusStack
                  status={s.status}
                  postStatus={s.postStatus}
                  shipmentStatus={s.shipmentStatus}
                  scheduledAt={s.scheduledAt}
                  paymentStatus={s.paymentStatus}
                  spkStatus={s.spkStatus}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </LabCard>
  );
}
