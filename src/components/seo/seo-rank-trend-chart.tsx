"use client";

import type { EChartsOption } from "echarts";
import { EChart } from "@/components/lab/echart";

/** Grafik tren posisi rata-rata (sumbu dibalik: posisi kecil = baik). */
export function SeoRankTrendChart({
  points,
}: {
  points: { date: string; avgPosition: number }[];
}) {
  const option: EChartsOption = {
    tooltip: { trigger: "axis" },
    grid: { left: 44, right: 16, top: 16, bottom: 28 },
    xAxis: { type: "time" },
    yAxis: { type: "value", inverse: true, min: 1, name: "Posisi" },
    series: [
      {
        name: "Posisi rata-rata",
        type: "line",
        smooth: true,
        showSymbol: false,
        areaStyle: { opacity: 0.12 },
        data: points.map((p) => [p.date, p.avgPosition] as [string, number]),
      },
    ],
  };
  return <EChart option={option} height={240} />;
}
