"use client";

import { useMemo } from "react";
import type { EChartsOption } from "echarts";
import { EChart } from "@/components/research-hub/echart";

const PHASE_COLOR: Record<string, string> = {
  EMERGING: "#22c55e",
  GROWING: "#3b82f6",
  PEAK: "#f59e0b",
  DECLINING: "#94a3b8",
};

/**
 * Trend momentum: horizontal bar of trend score (0-1), colored by lifecycle
 * phase — finally renders the stored-but-never-shown `score`.
 */
export function TrendScoreChart({
  items,
}: {
  items: { name: string; phase: string; score: number | null }[];
}) {
  const option = useMemo<EChartsOption>(() => {
    const sorted = [...items]
      .filter((i) => typeof i.score === "number")
      .sort((a, b) => (a.score ?? 0) - (b.score ?? 0))
      .slice(-14);
    return {
      grid: { left: 8, right: 24, top: 8, bottom: 24, containLabel: true },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        formatter: (params: unknown) => {
          const arr = params as { name: string; value: number }[];
          const p = arr[0];
          return p ? `${p.name}: ${(p.value * 100).toFixed(0)}` : "";
        },
      },
      xAxis: {
        type: "value",
        max: 1,
        axisLabel: { formatter: (v: number) => `${Math.round(v * 100)}`, fontSize: 10 },
        splitLine: { lineStyle: { color: "var(--border)", opacity: 0.4 } },
      },
      yAxis: {
        type: "category",
        data: sorted.map((i) => i.name),
        axisLabel: { fontSize: 11, width: 130, overflow: "truncate" },
      },
      series: [
        {
          type: "bar",
          data: sorted.map((i) => ({
            value: i.score ?? 0,
            itemStyle: { color: PHASE_COLOR[i.phase] ?? "#3b82f6" },
          })),
          barWidth: "62%",
          label: {
            show: true,
            position: "right",
            formatter: (p: unknown) =>
              `${Math.round(Number((p as { value?: number }).value ?? 0) * 100)}`,
            fontSize: 10,
          },
        },
      ],
    };
  }, [items]);

  if (items.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">Belum ada tren untuk diukur.</p>
    );
  }

  return <EChart option={option} height={Math.max(220, items.length * 26)} />;
}
