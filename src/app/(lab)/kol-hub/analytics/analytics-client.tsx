"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { EChartsOption } from "echarts";
import { ArrowDownRight, ArrowUpRight, BarChart3 } from "lucide-react";
import { compactNumber } from "@/components/brand-hub/influencer-badges";
import { KolSelect } from "@/components/kol-hub/kol-fields";
import { useUrlFilters } from "@/components/kol-hub/use-url-filters";
import { EChart } from "@/components/lab/echart";
import { LabCard, LabEmptyState, LabToolbar, lab } from "@/components/lab/lab-primitives";
import { rupiah, rupiahShort } from "@/lib/kol/format";
import type { AnalyticsDimension, KolAnalytics, MetricTotals } from "@/lib/kol/analytics";
import { cn } from "@/lib/utils";

const DIMENSIONS: { key: AnalyticsDimension; label: string }[] = [
  { key: "kol", label: "KOL" },
  { key: "campaign", label: "Campaign" },
  { key: "product", label: "Produk" },
  { key: "category", label: "Kategori" },
  { key: "brief", label: "Brief" },
  { key: "pic", label: "PIC" },
  { key: "tier", label: "Tier" },
  { key: "platform", label: "Platform" },
  { key: "placement", label: "Placement" },
  { key: "objective", label: "Tujuan" },
];

// Turunan dihitung ulang di klien (fungsi murni, sama dengan server).
function derive(t: MetricTotals) {
  const engagement = t.likes + t.comments + t.shares;
  return {
    fypRate: t.posted ? (t.fyp / t.posted) * 100 : null,
    postingRate: t.schedules ? (t.posted / t.schedules) * 100 : null,
    avgViews: t.posted ? t.views / t.posted : null,
    cpm: t.views ? t.postedCost / (t.views / 1000) : null,
    cpv: t.views ? t.postedCost / t.views : null,
    viewsPer1k: t.postedCost ? t.views / (t.postedCost / 1000) : null,
    er: t.views ? (engagement / t.views) * 100 : null,
  };
}

function pctChange(cur: number | null, prev: number | null): number | null {
  if (cur == null || prev == null || prev === 0) return null;
  return ((cur - prev) / prev) * 100;
}

function Kpi({
  label,
  value,
  sub,
  change,
  goodWhenDown,
}: {
  label: string;
  value: string;
  sub?: string;
  change?: number | null;
  /** Untuk biaya per views: turun = bagus. */
  goodWhenDown?: boolean;
}) {
  const good = change == null ? null : goodWhenDown ? change < 0 : change > 0;
  const Icon = change != null && change < 0 ? ArrowDownRight : ArrowUpRight;
  return (
    <div className="flex flex-col gap-1 px-4 py-3">
      <p className="text-muted-foreground text-[11px]">{label}</p>
      <p className="text-xl font-bold tabular-nums">{value}</p>
      <p className="flex items-center gap-1 text-[11px] tabular-nums">
        {change != null && Number.isFinite(change) ? (
          <span
            className={cn(
              "inline-flex items-center font-semibold",
              good ? "text-emerald-700 dark:text-emerald-300" : "text-red-600 dark:text-red-400",
            )}
          >
            <Icon className="size-3" aria-hidden />
            {Math.abs(change).toFixed(0)}%
          </span>
        ) : null}
        {sub ? <span className="text-muted-foreground">{sub}</span> : null}
      </p>
    </div>
  );
}

export function AnalyticsClient({
  data,
  by,
  periodKey,
  periodLabel,
  brands,
}: {
  data: KolAnalytics;
  by: AnalyticsDimension;
  periodKey: string;
  periodLabel: string;
  brands: { id: string; name: string }[];
}) {
  const { get, set, pending } = useUrlFilters();
  const cur = derive(data.totals);
  const prev = derive(data.previous);
  const dimLabel = DIMENSIONS.find((d) => d.key === by)?.label ?? "";

  const monthOptions = useMemo(() => {
    const out: { value: string; label: string }[] = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      out.push({
        value: d.toISOString().slice(0, 7),
        label: new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric", timeZone: "UTC" }).format(d),
      });
    }
    return out;
  }, []);

  const top = data.rows.filter((r) => r.views > 0).slice(0, 10);
  const chart: EChartsOption = {
    grid: { left: 8, right: 24, top: 8, bottom: 8, containLabel: true },
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    xAxis: { type: "value", axisLabel: { formatter: (v: number) => compactNumber(v) } },
    yAxis: {
      type: "category",
      inverse: true,
      data: top.map((r) => (r.label.length > 24 ? `${r.label.slice(0, 23)}…` : r.label)),
    },
    series: [
      {
        name: "Views",
        type: "bar",
        data: top.map((r) => r.views),
        barMaxWidth: 18,
        itemStyle: { borderRadius: [0, 4, 4, 0] },
        label: { show: true, position: "right", formatter: (p) => compactNumber(Number(p.value)) },
      },
    ],
  };

  return (
    <div className={cn("flex flex-col gap-6", pending && "opacity-70")}>
      <LabToolbar>
        <div role="group" aria-label="Periode" className="flex gap-1 rounded-lg bg-muted/50 p-0.5">
          {[
            { key: "7d", label: "7 hari" },
            { key: "30d", label: "30 hari" },
            { key: "90d", label: "90 hari" },
          ].map((p) => (
            <button
              key={p.key}
              type="button"
              aria-pressed={periodKey === p.key}
              onClick={() => set({ period: p.key === "30d" ? null : p.key })}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium",
                periodKey === p.key
                  ? "bg-card text-foreground shadow-sm ring-1 ring-border"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        <KolSelect
          className="h-8 w-[160px] text-xs"
          ariaLabel="Per bulan"
          value={/^\d{4}-\d{2}$/.test(periodKey) ? periodKey : ""}
          onChange={(v) => set({ period: v })}
          placeholder="Pilih bulan"
          options={monthOptions}
        />
        <div className="flex-1" />
        <KolSelect
          className="h-8 w-[160px] text-xs"
          ariaLabel="Filter brand"
          value={get("brand")}
          onChange={(v) => set({ brand: v })}
          emptyLabel="Semua brand"
          options={brands.map((b) => ({ value: b.id, label: b.name }))}
        />
        <KolSelect
          className="h-8 w-[140px] text-xs"
          ariaLabel="Filter platform"
          value={get("platform")}
          onChange={(v) => set({ platform: v })}
          emptyLabel="Semua platform"
          options={[
            { value: "INSTAGRAM", label: "Instagram" },
            { value: "TIKTOK", label: "TikTok" },
          ]}
        />
      </LabToolbar>

      <LabCard className="grid grid-cols-2 divide-border/60 p-0 sm:grid-cols-3 lg:grid-cols-6 lg:divide-x">
        <Kpi
          label="Total views"
          value={compactNumber(data.totals.views)}
          change={pctChange(data.totals.views, data.previous.views)}
          sub="vs periode sebelumnya"
        />
        <Kpi
          label="Konten tayang"
          value={`${data.totals.posted}/${data.totals.schedules}`}
          sub={cur.postingRate != null ? `${cur.postingRate.toFixed(0)}% dari jadwal` : undefined}
        />
        <Kpi
          label="Masuk FYP"
          value={String(data.totals.fyp)}
          sub={cur.fypRate != null ? `FYP rate ${cur.fypRate.toFixed(0)}%` : undefined}
          change={pctChange(data.totals.fyp, data.previous.fyp)}
        />
        <Kpi
          label="CPM"
          value={cur.cpm != null ? rupiahShort(cur.cpm) : "—"}
          change={pctChange(cur.cpm, prev.cpm)}
          goodWhenDown
          sub={cur.cpv != null ? `CPV ${rupiah(cur.cpv)}` : undefined}
        />
        <Kpi
          label="Views per Rp1.000"
          value={cur.viewsPer1k != null ? cur.viewsPer1k.toLocaleString("id-ID", { maximumFractionDigits: 1 }) : "—"}
          change={pctChange(cur.viewsPer1k, prev.viewsPer1k)}
        />
        <Kpi
          label="Biaya"
          value={rupiahShort(data.totals.cost)}
          sub={`dibayar ${rupiahShort(data.totals.paid)}`}
        />
      </LabCard>

      <div className="grid gap-3 sm:grid-cols-4">
        {[
          { label: "KOL dipakai", value: data.kolTracker.used, hint: `dari ${data.kolTracker.active} KOL aktif` },
          { label: "KOL baru", value: data.kolTracker.newKols, hint: "pertama kali dijadwalkan" },
          { label: "KOL repeat", value: data.kolTracker.repeatKols, hint: "pernah dijadwalkan sebelumnya" },
          { label: "KOL tidak terpakai", value: data.kolTracker.unused, hint: "aktif, tanpa jadwal periode ini" },
        ].map((x) => (
          <div key={x.label} className={cn(lab.panel, "p-4")}>
            <p className="text-muted-foreground text-[11px]">{x.label}</p>
            <p className="text-lg font-bold tabular-nums">{x.value}</p>
            <p className="text-muted-foreground text-[11px]">{x.hint}</p>
          </div>
        ))}
      </div>

      <section className={lab.section}>
        <div role="tablist" aria-label="Kelompokkan per" className="flex gap-1 overflow-x-auto border-b border-border/70">
          {DIMENSIONS.map((d) => (
            <button
              key={d.key}
              role="tab"
              aria-selected={by === d.key}
              onClick={() => set({ by: d.key === "kol" ? null : d.key })}
              className={cn(
                "-mb-px shrink-0 border-b-2 px-3 py-2 text-xs font-medium",
                by === d.key
                  ? "border-[var(--lab-accent,var(--primary))] text-foreground"
                  : "text-muted-foreground hover:text-foreground border-transparent",
              )}
            >
              Per {d.label.toLowerCase()}
            </button>
          ))}
        </div>

        {data.rows.length === 0 ? (
          <LabEmptyState
            icon={BarChart3}
            title={`Belum ada jadwal di ${periodLabel}`}
            description="Analytics dihitung dari jadwal yang diajukan, disetujui, atau tayang pada periode ini."
          />
        ) : (
          <>
            {top.length ? (
              <LabCard className="p-5">
                <h3 className="mb-2 text-sm font-semibold">Top {dimLabel.toLowerCase()} berdasarkan views</h3>
                <EChart option={chart} height={Math.max(160, top.length * 34)} />
              </LabCard>
            ) : null}
            <LabCard className="overflow-x-auto p-0">
              <table className="w-full min-w-[1080px] text-sm tabular-nums">
                <thead>
                  <tr className="text-muted-foreground border-b border-border/70 text-left text-[11px]">
                    <th className="px-4 py-2.5 font-medium">{dimLabel}</th>
                    <th className="px-3 py-2.5 text-right font-medium">Jadwal</th>
                    <th className="px-3 py-2.5 text-right font-medium">Tayang</th>
                    <th className="px-3 py-2.5 text-right font-medium">FYP</th>
                    <th className="px-3 py-2.5 text-right font-medium">Views</th>
                    <th className="px-3 py-2.5 text-right font-medium">Rata² views</th>
                    <th className="px-3 py-2.5 text-right font-medium">ER</th>
                    <th className="px-3 py-2.5 text-right font-medium">Biaya</th>
                    <th className="px-3 py-2.5 text-right font-medium">CPM</th>
                    <th className="px-3 py-2.5 text-right font-medium">Views/Rp1rb</th>
                    <th className="px-4 py-2.5 text-right font-medium">Dibayar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {data.rows.map((r) => {
                    const d = derive(r);
                    return (
                      <tr key={r.key} className="hover:bg-muted/40">
                        <td className="px-4 py-2.5 font-medium">
                          {r.href ? (
                            <Link href={r.href} className="hover:underline">
                              {r.label}
                            </Link>
                          ) : (
                            r.label
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right">{r.schedules}</td>
                        <td className="px-3 py-2.5 text-right">{r.posted}</td>
                        <td className="px-3 py-2.5 text-right">
                          {r.fyp}
                          {d.fypRate != null ? (
                            <span className="text-muted-foreground text-xs"> ({d.fypRate.toFixed(0)}%)</span>
                          ) : null}
                        </td>
                        <td className="px-3 py-2.5 text-right">{r.views ? compactNumber(r.views) : "—"}</td>
                        <td className="px-3 py-2.5 text-right">{d.avgViews != null ? compactNumber(d.avgViews) : "—"}</td>
                        <td className="px-3 py-2.5 text-right">{d.er != null ? `${d.er.toFixed(1)}%` : "—"}</td>
                        <td className="px-3 py-2.5 text-right">{rupiahShort(r.cost)}</td>
                        <td className="px-3 py-2.5 text-right">{d.cpm != null ? rupiahShort(d.cpm) : "—"}</td>
                        <td className="px-3 py-2.5 text-right">
                          {d.viewsPer1k != null ? d.viewsPer1k.toLocaleString("id-ID", { maximumFractionDigits: 1 }) : "—"}
                        </td>
                        <td className="px-4 py-2.5 text-right">{r.paid ? rupiahShort(r.paid) : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </LabCard>
            {by === "product" || by === "category" ? (
              <p className="text-muted-foreground text-xs">
                Satu jadwal bisa berisi beberapa {by === "product" ? "produk" : "kategori"}, jadi jumlah per baris
                bisa melebihi total.
              </p>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}
