"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useTransition } from "react";
import { Flame, RefreshCw, TrendingDown, TrendingUp, Minus } from "lucide-react";
import type { EChartsOption } from "echarts";
import { toast } from "sonner";
import { pollKolPostSync, syncSchedulePostNow } from "@/actions/kol-posts";
import { compactNumber } from "@/components/brand-hub/influencer-badges";
import { KolBadge } from "@/components/kol-hub/kol-badges";
import { EChart } from "@/components/lab/echart";
import { LabCard, lab } from "@/components/lab/lab-primitives";
import { Button } from "@/components/ui/button";
import { actionErrorMessage } from "@/lib/action-error-message";
import { rupiah } from "@/lib/kol/format";
import {
  computePostMetrics,
  cpm,
  cpv,
  engagementRate,
  viewsPerThousandRupiah,
  type SnapshotPoint,
} from "@/lib/kol/metrics";
import { formatWibDateTime } from "@/lib/kol/time";
import { cn } from "@/lib/utils";

const dayLabel = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", timeZone: "UTC" });
const fmtDay = (d: string) => dayLabel.format(new Date(`${d}T00:00:00Z`));

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className={cn(lab.nestedPanel, "p-3")} title={hint}>
      <p className="text-muted-foreground text-[11px]">{label}</p>
      <p className="text-base font-semibold tabular-nums">{value}</p>
    </div>
  );
}

export function PostMetricsPanel({
  scheduleId,
  canSync,
  snapshots,
  cost,
  fypThreshold,
  postedAt,
  followersAtBooking,
  syncedAt,
  error,
  syncing,
}: {
  scheduleId: string;
  canSync: boolean;
  snapshots: SnapshotPoint[];
  cost: number;
  fypThreshold: number;
  postedAt: string | null;
  followersAtBooking: number | null;
  syncedAt: string | null;
  error: string | null;
  syncing: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const m = useMemo(
    () => computePostMetrics(snapshots, { fypThreshold, postedAt }),
    [snapshots, fypThreshold, postedAt],
  );

  // Selama run berjalan: majukan & cek tiap 10 dtk, muat ulang saat selesai.
  useEffect(() => {
    if (!syncing) return;
    const t = setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const { inFlight } = await pollKolPostSync(scheduleId);
        if (!inFlight) router.refresh();
      } catch {
        /* dicoba lagi pada interval berikutnya */
      }
    }, 10_000);
    return () => clearInterval(t);
  }, [syncing, scheduleId, router]);

  const views = m.latest?.views ?? null;
  const er = m.latest ? engagementRate(m.latest) : null;
  const perK = viewsPerThousandRupiah(cost, views);

  const lineOption: EChartsOption = {
    grid: { left: 8, right: 16, top: 16, bottom: 8, containLabel: true },
    tooltip: { trigger: "axis" },
    xAxis: { type: "category", data: snapshots.map((s) => fmtDay(s.day)), boundaryGap: false },
    yAxis: { type: "value", axisLabel: { formatter: (v: number) => compactNumber(v) } },
    series: [
      {
        name: "Views",
        type: "line",
        data: snapshots.map((s) => s.views),
        smooth: false,
        symbolSize: 8,
        lineStyle: { width: 2 },
        areaStyle: { opacity: 0.08 },
        // Garis ambang FYP hanya bila relevan (tidak menekan skala grafik kecil).
        markLine:
          (views ?? 0) >= fypThreshold * 0.5
            ? {
                symbol: "none",
                label: { formatter: "Ambang FYP", position: "insideEndTop" },
                lineStyle: { type: "dashed", width: 1 },
                data: [{ yAxis: fypThreshold }],
              }
            : undefined,
      },
    ],
  };

  const barOption: EChartsOption = {
    grid: { left: 8, right: 16, top: 16, bottom: 8, containLabel: true },
    tooltip: { trigger: "axis" },
    xAxis: { type: "category", data: m.velocity.map((v) => fmtDay(v.day)) },
    yAxis: { type: "value", axisLabel: { formatter: (v: number) => compactNumber(v) } },
    series: [
      {
        name: "Views baru",
        type: "bar",
        data: m.velocity.map((v) => v.delta),
        barMaxWidth: 24,
        itemStyle: { borderRadius: [4, 4, 0, 0] },
      },
    ],
  };

  const MomentumIcon = m.momentum === "naik" ? TrendingUp : m.momentum === "turun" ? TrendingDown : Minus;

  return (
    <LabCard className="flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className={cn(lab.sectionTitle, "flex items-center gap-2")}>
            Performa post
            {m.isFyp ? (
              <KolBadge tone="success" title={`Views ≥ ${compactNumber(fypThreshold)}`}>
                <Flame className="size-3" aria-hidden />
                FYP{m.fypDay ? ` sejak ${fmtDay(m.fypDay)}` : ""}
              </KolBadge>
            ) : null}
          </h2>
          <p className="text-muted-foreground text-xs">
            {syncing
              ? "Mengambil metrik terbaru… halaman diperbarui otomatis."
              : syncedAt
                ? `Diperbarui ${formatWibDateTime(syncedAt)} · diambil otomatis tiap hari`
                : "Metrik diambil otomatis tiap hari setelah link post dicatat."}
          </p>
        </div>
        {canSync ? (
          <Button
            size="sm"
            variant="outline"
            disabled={pending || syncing}
            onClick={() =>
              startTransition(async () => {
                try {
                  await syncSchedulePostNow(scheduleId);
                  toast.success("Sinkronisasi dimulai — biasanya selesai dalam 1–3 menit.");
                  router.refresh();
                } catch (err) {
                  toast.error(actionErrorMessage(err, "Gagal memulai sinkronisasi."));
                }
              })
            }
          >
            <RefreshCw className={cn(syncing && "animate-spin")} />
            Sinkron sekarang
          </Button>
        ) : null}
      </div>

      {error ? (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-300">
          {error}
        </p>
      ) : null}

      {snapshots.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          {canSync ? "Belum ada data metrik untuk post ini." : "Metrik muncul setelah konten tayang dan link post dicatat."}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Kpi label="Views" value={views != null ? compactNumber(views) : "—"} />
            <Kpi
              label="Likes · komentar"
              value={m.latest ? `${compactNumber(m.latest.likes)} · ${compactNumber(m.latest.comments)}` : "—"}
            />
            <Kpi
              label="Engagement rate"
              value={er != null ? `${er.toFixed(1)}%` : "—"}
              hint="(likes + komentar + share) ÷ views"
            />
            <Kpi
              label="Views ÷ follower"
              value={views != null && followersAtBooking ? `${((views / followersAtBooking) * 100).toFixed(0)}%` : "—"}
              hint="Dibanding follower saat jadwal disetujui"
            />
            <Kpi label="CPV" value={cpv(cost, views) != null ? rupiah(cpv(cost, views)) : "—"} hint="Biaya ÷ views" />
            <Kpi label="CPM" value={cpm(cost, views) != null ? rupiah(cpm(cost, views)) : "—"} hint="Biaya per 1.000 views" />
            <Kpi
              label="Views per Rp1.000"
              value={perK != null ? perK.toLocaleString("id-ID", { maximumFractionDigits: 1 }) : "—"}
            />
            <Kpi
              label="Puncak harian"
              value={m.peakVelocity != null ? `+${compactNumber(m.peakVelocity)}` : "—"}
              hint={
                m.timeToPeakHours != null
                  ? `Tercapai ±${Math.round(m.timeToPeakHours / 24)} hari setelah tayang`
                  : undefined
              }
            />
          </div>

          <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs">
            {m.momentum ? (
              <span className="inline-flex items-center gap-1">
                <MomentumIcon className="size-3.5" aria-hidden />
                Momentum {m.momentum}
              </span>
            ) : null}
            {m.decayRate != null ? (
              <span title="(puncak − kenaikan terakhir) ÷ puncak">
                Pertumbuhan melambat {m.decayRate.toFixed(0)}% dari puncak
              </span>
            ) : null}
            {cost === 0 ? <span>Barter — CPV/CPM tidak dihitung.</span> : null}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <p className="mb-1 text-xs font-medium">Total views per hari</p>
              <EChart option={lineOption} height={220} />
            </div>
            <div>
              <p className="mb-1 text-xs font-medium">Views baru per hari</p>
              <EChart option={barOption} height={220} />
            </div>
          </div>
          <details className="text-xs">
            <summary className="text-muted-foreground cursor-pointer">Lihat tabel</summary>
            <table className="mt-2 w-full tabular-nums">
              <thead>
                <tr className="text-muted-foreground text-left">
                  <th className="py-1 font-medium">Hari</th>
                  <th className="py-1 text-right font-medium">Views</th>
                  <th className="py-1 text-right font-medium">Likes</th>
                  <th className="py-1 text-right font-medium">Komentar</th>
                  <th className="py-1 text-right font-medium">Share</th>
                </tr>
              </thead>
              <tbody>
                {snapshots.map((s) => (
                  <tr key={s.day} className="border-t border-border/50">
                    <td className="py-1">{fmtDay(s.day)}</td>
                    <td className="py-1 text-right">{s.views.toLocaleString("id-ID")}</td>
                    <td className="py-1 text-right">{s.likes.toLocaleString("id-ID")}</td>
                    <td className="py-1 text-right">{s.comments.toLocaleString("id-ID")}</td>
                    <td className="py-1 text-right">{s.shares.toLocaleString("id-ID")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </>
      )}
    </LabCard>
  );
}
