"use client";

import { useEffect, useRef } from "react";
// echarts/core + registrasi eksplisit (bukan `import * from "echarts"`) agar
// hanya jenis chart yang benar-benar dipakai yang ikut bundle (~1MB → ~300KB).
// Menambah jenis chart baru? Daftarkan series/komponennya di `echarts.use` ini.
import * as echarts from "echarts/core";
import {
  BarChart,
  LineChart,
  PieChart,
  RadarChart,
  SankeyChart,
  ScatterChart,
} from "echarts/charts";
import {
  AxisPointerComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  RadarComponent,
  TooltipComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { EChartsOption } from "echarts";
import { cn } from "@/lib/utils";

echarts.use([
  BarChart,
  LineChart,
  PieChart,
  RadarChart,
  SankeyChart,
  ScatterChart,
  AxisPointerComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  RadarComponent,
  TooltipComponent,
  CanvasRenderer,
]);

type EChartsInstance = ReturnType<typeof echarts.init>;

/**
 * Wrapper Apache ECharts yang sadar tema. Membaca token CSS (`--chart-*`,
 * `--border`, `--popover`, dst.) dari elemen kontainer sehingga chart otomatis
 * mengikuti palet aktif — termasuk takeover Dominatus Lab. Default tooltip,
 * axis, splitLine, dan palet series di-tema-kan di sini agar chart tanpa
 * `itemStyle` eksplisit langsung benar di light maupun dark.
 */
export function EChart({
  option,
  className,
  height = 300,
  notMerge = true,
}: {
  option: EChartsOption;
  className?: string;
  height?: number;
  notMerge?: boolean;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<EChartsInstance | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const chart = echarts.init(ref.current, undefined, {
      renderer: "canvas",
    });
    chartRef.current = chart;

    const resize = () => chart.resize();
    const observer = new ResizeObserver(resize);
    observer.observe(ref.current);
    window.addEventListener("resize", resize);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", resize);
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    const styles = ref.current ? getComputedStyle(ref.current) : null;
    const token = (name: string, fallback: string) =>
      styles?.getPropertyValue(name)?.trim() || fallback;

    const textColor = token("--muted-foreground", "#64748b");
    const borderColor = token("--border", "rgba(100,116,139,0.25)");
    const popoverBg = token("--popover", "#ffffff");
    const popoverFg = token("--popover-foreground", "#0f172a");

    const axisDefaults = {
      axisLine: { lineStyle: { color: borderColor } },
      axisTick: { lineStyle: { color: borderColor } },
      splitLine: { lineStyle: { color: borderColor } },
      axisLabel: { color: textColor },
    };

    const themed: EChartsOption = {
      color: chartPalette(ref.current),
      textStyle: { fontFamily: "inherit", color: textColor },
      tooltip: {
        backgroundColor: popoverBg,
        borderColor,
        textStyle: { color: popoverFg },
      },
      ...option,
    };

    // Gabungkan default axis tanpa menimpa opsi eksplisit dari pemanggil.
    const mergeAxis = (axis: unknown): unknown =>
      Array.isArray(axis)
        ? axis.map((a) => ({ ...axisDefaults, ...(a as object) }))
        : axis && typeof axis === "object"
          ? { ...axisDefaults, ...(axis as object) }
          : axis;
    if (option.xAxis) {
      themed.xAxis = mergeAxis(option.xAxis) as EChartsOption["xAxis"];
    }
    if (option.yAxis) {
      themed.yAxis = mergeAxis(option.yAxis) as EChartsOption["yAxis"];
    }
    if (option.tooltip && typeof option.tooltip === "object") {
      themed.tooltip = {
        backgroundColor: popoverBg,
        borderColor,
        textStyle: { color: popoverFg },
        ...option.tooltip,
      };
    }

    chart.setOption(themed, { notMerge });
  }, [option, notMerge]);

  return <div ref={ref} className={cn("w-full", className)} style={{ height }} />;
}

/** Palet chart standar dari token CSS (client-only). */
export function chartPalette(el?: HTMLElement | null): string[] {
  const styles = el ? getComputedStyle(el) : null;
  const read = (name: string, fallback: string) =>
    styles?.getPropertyValue(name)?.trim() || fallback;
  return [
    read("--chart-1", "#8b5cf6"),
    read("--chart-2", "#06b6d4"),
    read("--chart-3", "#f472b6"),
    read("--chart-4", "#34d399"),
    read("--chart-5", "#f59e0b"),
  ];
}
