"use client";

import { useMemo } from "react";
import type { EChartsOption } from "echarts";
import { EChart } from "@/components/research-hub/echart";

export type PositioningPoint = {
  name: string;
  brand: string;
  x: number;
  y: number;
};

export function PositioningScatterChart({
  axisX,
  axisY,
  points,
}: {
  axisX: string;
  axisY: string;
  points: PositioningPoint[];
}) {
  const option = useMemo<EChartsOption>(() => {
    return {
      grid: { left: 8, right: 24, top: 24, bottom: 36, containLabel: true },
      tooltip: {
        trigger: "item",
        formatter: (p: unknown) => {
          const d = p as { data: { value: [number, number]; name: string; brand: string } };
          return `<b>${d.data.name}</b><br/>${d.data.brand}<br/>${axisX}: ${d.data.value[0]}<br/>${axisY}: ${d.data.value[1]}`;
        },
      },
      xAxis: {
        type: "value",
        name: axisX,
        nameLocation: "middle",
        nameGap: 26,
        min: 0,
        max: 100,
        axisLabel: { fontSize: 10 },
      },
      yAxis: {
        type: "value",
        name: axisY,
        nameLocation: "middle",
        nameGap: 32,
        min: 0,
        max: 100,
        axisLabel: { fontSize: 10 },
      },
      series: [
        {
          type: "scatter",
          symbolSize: 18,
          // Warna series ikut palet tema dari wrapper EChart (--chart-1);
          // canvas tidak bisa membaca CSS var langsung.
          itemStyle: { opacity: 0.8 },
          markLine: {
            silent: true,
            symbol: "none",
            lineStyle: { type: "dashed", color: "#94a3b8", opacity: 0.5 },
            data: [{ xAxis: 50 }, { yAxis: 50 }],
          },
          label: {
            show: true,
            position: "top",
            formatter: (p: unknown) =>
              (p as { data: { name: string } }).data.name,
            fontSize: 10,
          },
          data: points.map((p) => ({
            value: [p.x, p.y],
            name: p.name,
            brand: p.brand,
          })),
        },
      ],
    };
  }, [axisX, axisY, points]);

  if (points.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Positioning map belum tersedia.
      </p>
    );
  }

  return <EChart option={option} height={360} />;
}
