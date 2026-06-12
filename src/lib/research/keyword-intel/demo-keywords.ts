import "server-only";

import type { RawKeywordSignal } from "@/lib/research/keyword-intel/collect-keywords";

export function generateDemoKeywordSignals(
  category: string,
): RawKeywordSignal[] {
  const base = category.toLowerCase();
  return [
    {
      keyword: `${base} terbaik`,
      sources: ["demo"],
      volume: 14800,
      competition: 0.72,
      trend: "up",
    },
    {
      keyword: `${base} murah`,
      sources: ["demo"],
      volume: 9900,
      competition: 0.85,
      trend: "stable",
    },
    {
      keyword: `${base} untuk kulit sensitif`,
      sources: ["demo"],
      volume: 5400,
      competition: 0.41,
      trend: "up",
    },
    {
      keyword: `${base} bpom`,
      sources: ["demo"],
      volume: 3200,
      competition: 0.55,
      trend: "stable",
    },
    {
      keyword: `${base} glowing`,
      sources: ["demo"],
      volume: 8100,
      competition: 0.68,
      trend: "up",
    },
    {
      keyword: `${base} fragrance free`,
      sources: ["demo"],
      volume: 2100,
      competition: 0.28,
      trend: "up",
    },
    {
      keyword: `review ${base}`,
      sources: ["demo"],
      volume: 4500,
      competition: 0.35,
      trend: "stable",
    },
    {
      keyword: `${base} korea`,
      sources: ["demo"],
      volume: 6700,
      competition: 0.62,
      trend: "down",
    },
    {
      keyword: `${base} lokal`,
      sources: ["demo"],
      volume: 3800,
      competition: 0.44,
      trend: "up",
    },
    {
      keyword: `cara pakai ${base}`,
      sources: ["demo"],
      volume: 1900,
      competition: 0.22,
      trend: "stable",
    },
  ];
}
