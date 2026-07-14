"use client";

import { useMemo } from "react";
import type { EChartsOption } from "echarts";
import { EChart } from "@/components/lab/echart";

// canvas: CSS var tidak didukung — pakai hex tetap yang ramah palet Lab.
const CLASS_COLOR: Record<string, string> = {
  PRAISE: "#34d399",
  RECOMMENDATION: "#06b6d4",
  COMPLAINT: "#f87171",
  QUESTION: "#8b5cf6",
  WISHLIST: "#f472b6",
  NEUTRAL: "#94a3b8",
};

const CLASS_LABEL: Record<string, string> = {
  PRAISE: "Pujian",
  RECOMMENDATION: "Rekomendasi",
  COMPLAINT: "Keluhan",
  QUESTION: "Pertanyaan",
  WISHLIST: "Wishlist",
  NEUTRAL: "Netral",
};

export function SentimentBreakdownDonut({
  data,
}: {
  data: { classification: string; count: number; pct: number }[];
}) {
  const option = useMemo<EChartsOption>(
    () => ({
      tooltip: {
        trigger: "item",
        formatter: (p: unknown) => {
          const d = p as { name: string; value: number; percent: number };
          return `${d.name}: ${d.value} (${d.percent}%)`;
        },
      },
      legend: { bottom: 0, type: "scroll", textStyle: { fontSize: 11 } },
      series: [
        {
          type: "pie",
          radius: ["45%", "70%"],
          center: ["50%", "44%"],
          avoidLabelOverlap: true,
          // canvas: CSS var tidak didukung — pakai transparent untuk celah antar-slice.
          itemStyle: { borderRadius: 4, borderColor: "transparent", borderWidth: 2 },
          label: { show: false },
          data: data.map((d) => ({
            name: CLASS_LABEL[d.classification] ?? d.classification,
            value: d.count,
            itemStyle: { color: CLASS_COLOR[d.classification] ?? "#94a3b8" },
          })),
        },
      ],
    }),
    [data],
  );

  if (data.length === 0) {
    return <p className="text-muted-foreground text-sm">Belum ada data kategori.</p>;
  }
  return <EChart option={option} height={240} />;
}

export function SentimentTimelineChart({
  data,
}: {
  data: { date: string; positive: number; negative: number; neutral: number }[];
}) {
  const option = useMemo<EChartsOption>(
    () => ({
      grid: { left: 8, right: 16, top: 30, bottom: 24, containLabel: true },
      tooltip: { trigger: "axis" },
      legend: { top: 0, textStyle: { fontSize: 11 } },
      xAxis: {
        type: "category",
        data: data.map((d) => d.date.slice(5)),
        axisLabel: { fontSize: 10 },
      },
      yAxis: { type: "value", axisLabel: { fontSize: 10 } },
      series: [
        // canvas: CSS var tidak didukung — hex semantik ramah palet Lab.
        {
          name: "Positif",
          type: "line",
          smooth: true,
          data: data.map((d) => d.positive),
          itemStyle: { color: "#34d399" },
          areaStyle: { opacity: 0.12 },
        },
        {
          name: "Negatif",
          type: "line",
          smooth: true,
          data: data.map((d) => d.negative),
          itemStyle: { color: "#f87171" },
          areaStyle: { opacity: 0.12 },
        },
        {
          name: "Netral",
          type: "line",
          smooth: true,
          data: data.map((d) => d.neutral),
          itemStyle: { color: "#94a3b8" },
        },
      ],
    }),
    [data],
  );

  if (data.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Belum ada data tanggal untuk tren sentimen.
      </p>
    );
  }
  return <EChart option={option} height={240} />;
}

export function ShareOfVoiceChart({
  data,
}: {
  data: { platform: string; count: number }[];
}) {
  const option = useMemo<EChartsOption>(
    () => ({
      tooltip: {
        trigger: "item",
        formatter: (p: unknown) => {
          const d = p as { name: string; value: number; percent: number };
          return `${d.name}: ${d.value} mention (${d.percent}%)`;
        },
      },
      legend: { bottom: 0, textStyle: { fontSize: 11 } },
      series: [
        {
          type: "pie",
          radius: "62%",
          center: ["50%", "44%"],
          label: { show: false },
          // Warna slice mengikuti palet tema yang diinjeksi wrapper EChart.
          data: data.map((d) => ({
            name: d.platform,
            value: d.count,
          })),
        },
      ],
    }),
    [data],
  );

  if (data.every((d) => d.count === 0)) {
    return <p className="text-muted-foreground text-sm">Belum ada mention.</p>;
  }
  return <EChart option={option} height={240} />;
}
