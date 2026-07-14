"use client";

import { useMemo } from "react";
import type { EChartsOption } from "echarts";
import { EChart } from "@/components/lab/echart";

export function ConceptValidationRadar({
  marketDemand,
  differentiation,
  pricingFit,
  overall,
}: {
  marketDemand: number;
  differentiation: number;
  pricingFit: number;
  overall: number;
}) {
  const option = useMemo<EChartsOption>(
    () => ({
      tooltip: {},
      radar: {
        indicator: [
          { name: "Market Demand", max: 100 },
          { name: "Differentiation", max: 100 },
          { name: "Pricing Fit", max: 100 },
          { name: "Overall", max: 100 },
        ],
        radius: "62%",
        // canvas: CSS var tidak didukung — garis grid radar pakai netral tetap.
        splitLine: { lineStyle: { color: "#94a3b8", opacity: 0.35 } },
        splitArea: { areaStyle: { opacity: 0.04 } },
        axisName: { fontSize: 11 },
      },
      series: [
        {
          type: "radar",
          data: [
            {
              value: [
                Math.round(marketDemand),
                Math.round(differentiation),
                Math.round(pricingFit),
                Math.round(overall),
              ],
              name: "Skor Validasi",
              areaStyle: { opacity: 0.18 },
              lineStyle: { width: 2 },
            },
          ],
        },
      ],
    }),
    [marketDemand, differentiation, pricingFit, overall],
  );

  return <EChart option={option} height={240} />;
}
