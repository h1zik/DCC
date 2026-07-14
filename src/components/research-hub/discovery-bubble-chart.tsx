"use client";

import { useMemo } from "react";
import type { EChartsOption } from "echarts";
import { EChart } from "@/components/lab/echart";

type BubblePoint = {
  name: string;
  price: number;
  rating: number;
  sold: number;
  marketplace: string;
};

function truncateLabel(name: string, max = 60): string {
  return name.length > max ? `${name.slice(0, max - 1)}…` : name;
}

/**
 * Price (x) vs rating (y) vs sales-volume (bubble size) scatter — reveals the
 * value/whitespace landscape: high-rating low-price clusters, premium gaps, etc.
 */
export function DiscoveryBubbleChart({ points }: { points: BubblePoint[] }) {
  const option = useMemo<EChartsOption>(() => {
    const maxSold = Math.max(1, ...points.map((p) => p.sold));
    return {
      grid: { left: 56, right: 80, top: 24, bottom: 48 },
      tooltip: {
        trigger: "item",
        confine: true,
        appendToBody: true,
        extraCssText:
          "max-width:260px;white-space:normal;word-break:break-word;line-height:1.4;",
        position: (
          point: number[],
          _params: unknown,
          _dom: unknown,
          _rect: unknown,
          size: { contentSize: number[]; viewSize: number[] },
        ) => {
          const [x, y] = point;
          const [tipW, tipH] = size.contentSize;
          const [viewW] = size.viewSize;
          const gap = 12;
          const placeLeft = x > viewW * 0.55;
          return {
            left: placeLeft ? x - tipW - gap : x + gap,
            top: Math.max(8, y - tipH / 2),
          };
        },
        formatter: (params: unknown) => {
          const p = params as { data: [number, number, number, string] };
          const [price, rating, sold, name] = p.data;
          const label = truncateLabel(String(name));
          return `<b>${label}</b><br/>Harga: Rp${price.toLocaleString("id-ID")}<br/>Rating: ${rating.toFixed(1)}<br/>Terjual: ${sold.toLocaleString("id-ID")}`;
        },
      },
      xAxis: {
        type: "value",
        name: "Harga (Rp)",
        nameLocation: "middle",
        nameGap: 32,
        axisLabel: {
          formatter: (v: number) => `${Math.round(v / 1000)}k`,
          fontSize: 10,
        },
      },
      yAxis: {
        type: "value",
        name: "Rating",
        min: 0,
        max: 5,
      },
      series: [
        {
          type: "scatter",
          symbolSize: (data: number[]) => {
            const sold = data[2] ?? 0;
            return 8 + (sold / maxSold) * 36;
          },
          // Warna series dari palet tema EChart (canvas: CSS var tidak didukung).
          itemStyle: {
            opacity: 0.6,
          },
          data: points.map((p) => [p.price, p.rating, p.sold, p.name]),
        },
      ],
    };
  }, [points]);

  if (points.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Belum ada data harga/rating untuk divisualisasikan.
      </p>
    );
  }

  return <EChart option={option} height={340} />;
}
