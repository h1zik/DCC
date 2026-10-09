"use client";

import { useMemo } from "react";
import type { EChartsOption } from "echarts";
import { InfluencerAuditStatus } from "@prisma/client";
import { EChart } from "@/components/lab/echart";
import { compactNumber } from "@/components/brand-hub/influencer-badges";
import type { AuditView, PostView } from "./types";

function cssVar(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  return (
    getComputedStyle(document.documentElement).getPropertyValue(name).trim() ||
    fallback
  );
}

const dateLabel = (iso: string) =>
  new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "2-digit",
  });

/**
 * ER tiap post di sampel, dipisah per format. Satu angka median menyembunyikan
 * bentuk sebarannya: akun yang stabil dan akun yang hidup dari satu-dua post
 * viral bisa punya median yang sama persis.
 */
export function ErDistributionChart({
  posts,
  benchmarkEr,
  medianEr,
}: {
  posts: PostView[];
  benchmarkEr: number | null;
  medianEr: number;
}) {
  const option = useMemo<EChartsOption | null>(() => {
    const measured = posts.filter((p) => p.inSample && p.likes >= 0);
    if (measured.length < 3) return null;

    const surfaces = Array.from(new Set(measured.map((p) => p.surface)));
    const label = (s: string) => (s === "reels" ? "Reels" : "Feed");
    const go = cssVar("--iv-go", "#2f7d5b");
    const weak = cssVar("--iv-weak", "#6b7280");
    const fair = cssVar("--iv-fair", "#a07a1f");

    return {
      grid: { left: 56, right: 24, top: 28, bottom: 36 },
      tooltip: {
        trigger: "item",
        formatter: (p: unknown) => {
          const d = (p as { data: { value: [number, string]; date: string; sponsored: boolean } }).data;
          return `${d.value[0].toLocaleString("id-ID", { maximumFractionDigits: 2 })}% ER<br/>${d.date}${d.sponsored ? " · berbayar" : ""}`;
        },
      },
      xAxis: {
        type: "value",
        name: "ER per post (%)",
        nameLocation: "middle",
        nameGap: 26,
        min: 0,
      },
      yAxis: {
        type: "category",
        data: surfaces.map(label),
        axisTick: { show: false },
      },
      series: [
        {
          type: "scatter",
          symbolSize: 11,
          data: measured.map((p) => ({
            value: [p.engagementRate, label(p.surface)],
            date: p.postedAt ? dateLabel(p.postedAt) : "tanpa tanggal",
            sponsored: p.isSponsored,
            itemStyle: {
              color: p.isSponsored ? fair : go,
              opacity: 0.75,
            },
          })),
          markLine: {
            symbol: "none",
            silent: true,
            label: { formatter: "{b}", position: "insideEndTop", fontSize: 10 },
            data: [
              {
                name: "median akun ini",
                xAxis: medianEr,
                lineStyle: { color: go, type: "solid", width: 1.5 },
              },
              ...(benchmarkEr
                ? [
                    {
                      name: "median tier",
                      xAxis: benchmarkEr,
                      lineStyle: { color: weak, type: "dashed" as const, width: 1 },
                    },
                  ]
                : []),
            ],
          },
        },
      ],
    };
  }, [posts, benchmarkEr, medianEr]);

  if (!option) return null;
  return (
    <figure className="flex flex-col gap-2">
      <EChart option={option} height={surfacesHeight(posts)} />
      <figcaption className="text-muted-foreground text-xs leading-relaxed">
        Satu titik = satu post dalam sampel. Titik kuning = post berbayar.
        Sebaran yang rapat berarti hasil yang bisa diprediksi; titik yang
        menyendiri jauh di kanan adalah post viral yang tidak boleh dijadikan
        patokan.
      </figcaption>
    </figure>
  );
}

function surfacesHeight(posts: PostView[]): number {
  const n = new Set(posts.filter((p) => p.inSample).map((p) => p.surface)).size;
  return n > 1 ? 200 : 150;
}

/**
 * Follower dan ER dari audit ke audit. Lonjakan follower tanpa kenaikan
 * interaksi tampak sebagai garis follower yang naik tajam sementara ER jatuh.
 */
export function AuditHistoryChart({ audits }: { audits: AuditView[] }) {
  const option = useMemo<EChartsOption | null>(() => {
    const ready = audits
      .filter((a) => a.status === InfluencerAuditStatus.READY)
      .slice()
      .reverse();
    if (ready.length < 2) return null;

    const accent = cssVar("--iv-go", "#2f7d5b");
    const weak = cssVar("--iv-weak", "#6b7280");
    const labels = ready.map((a) => dateLabel(a.collectedAt ?? a.createdAt));

    return {
      grid: { left: 52, right: 52, top: 36, bottom: 28 },
      legend: { top: 0, data: ["Follower", "ER"] },
      tooltip: { trigger: "axis" },
      xAxis: { type: "category", data: labels, boundaryGap: true },
      yAxis: [
        {
          type: "value",
          name: "Follower",
          axisLabel: { formatter: (v: number) => compactNumber(v) },
          splitLine: { show: false },
        },
        {
          type: "value",
          name: "ER %",
          axisLabel: { formatter: "{value}%" },
        },
      ],
      series: [
        {
          name: "Follower",
          type: "bar",
          barMaxWidth: 28,
          itemStyle: { color: weak, opacity: 0.35, borderRadius: [4, 4, 0, 0] },
          data: ready.map((a) => a.followers),
        },
        {
          name: "ER",
          type: "line",
          yAxisIndex: 1,
          symbolSize: 7,
          lineStyle: { width: 2.5, color: accent },
          itemStyle: { color: accent },
          data: ready.map((a) => Number(a.engagementRate.toFixed(3))),
        },
      ],
    };
  }, [audits]);

  if (!option) return null;
  return <EChart option={option} height={240} />;
}
