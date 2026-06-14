"use client";

import { useEffect, useRef } from "react";
import * as echarts from "echarts";
import { cn } from "@/lib/utils";

/**
 * Theme-aware Apache ECharts wrapper. Reads the app's `--chart-*` / `--border`
 * CSS tokens so charts match the active palette (light/dark) and resizes with
 * its container. Use for advanced/interactive viz (scatter gap maps, radar,
 * bubble, sankey, heatmaps). Keep Recharts for simple charts.
 */
export function EChart({
  option,
  className,
  height = 300,
  notMerge = true,
}: {
  option: echarts.EChartsOption;
  className?: string;
  height?: number;
  notMerge?: boolean;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);

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

    const styles = ref.current
      ? getComputedStyle(ref.current)
      : null;
    const token = (name: string, fallback: string) =>
      styles?.getPropertyValue(name)?.trim() || fallback;

    const textColor = token("--muted-foreground", "#64748b");

    const themed: echarts.EChartsOption = {
      textStyle: { fontFamily: "inherit", color: textColor },
      ...option,
    };

    chart.setOption(themed, { notMerge });
  }, [option, notMerge]);

  return <div ref={ref} className={cn("w-full", className)} style={{ height }} />;
}

/** Resolve the standard chart palette from CSS tokens (client-only). */
export function chartPalette(el?: HTMLElement | null): string[] {
  const styles = el ? getComputedStyle(el) : null;
  const read = (name: string, fallback: string) =>
    styles?.getPropertyValue(name)?.trim() || fallback;
  return [
    read("--chart-1", "#ef4444"),
    read("--chart-2", "#22c55e"),
    read("--chart-3", "#3b82f6"),
    read("--chart-4", "#f59e0b"),
    read("--chart-5", "#8b5cf6"),
  ];
}
