"use client";

import { useMemo } from "react";
import type { EChartsOption } from "echarts";
import { EChart } from "@/components/research-hub/echart";

export type FeedbackLoopData = {
  nodes: { name: string }[];
  links: { source: string; target: string; value: number }[];
};

/**
 * Sankey of the research feedback loop: raw signals -> insight engine ->
 * USP/Gap -> product concepts. Makes the cross-module flow tangible.
 */
export function ReportFeedbackSankey({ data }: { data: FeedbackLoopData }) {
  const option = useMemo<EChartsOption>(
    () => ({
      tooltip: { trigger: "item", triggerOn: "mousemove" },
      series: [
        {
          type: "sankey",
          left: 8,
          right: 120,
          top: 12,
          bottom: 12,
          emphasis: { focus: "adjacency" },
          nodeWidth: 14,
          nodeGap: 10,
          data: data.nodes,
          links: data.links,
          lineStyle: { color: "gradient", curveness: 0.5, opacity: 0.45 },
          label: { fontSize: 11, color: "var(--foreground)" },
          itemStyle: { borderWidth: 0 },
        },
      ],
    }),
    [data],
  );

  if (data.nodes.length === 0 || data.links.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Belum cukup aktivitas untuk memetakan feedback loop.
      </p>
    );
  }

  return <EChart option={option} height={300} />;
}
