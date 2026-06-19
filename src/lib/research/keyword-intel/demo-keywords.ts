import "server-only";

import type { NormalizedKeywordSignal } from "@/lib/research/keyword-intel/keyword-signal-types";
import { signalId } from "@/lib/research/keyword-intel/keyword-signal-types";

function demoSignal(
  keyword: string,
  volume: number,
  competition: number,
  trend: "up" | "down" | "stable",
): NormalizedKeywordSignal {
  return {
    signalId: signalId("demo", keyword, "volume"),
    source: "demo",
    keyword,
    metric: "volume",
    value: volume,
    volume,
    competition,
    trend,
  };
}

/** Test-only demo signals — never used in production pipeline. */
export function generateDemoKeywordSignals(
  category: string,
): NormalizedKeywordSignal[] {
  const base = category.toLowerCase();
  return [
    demoSignal(`${base} terbaik`, 14800, 0.72, "up"),
    demoSignal(`${base} murah`, 9900, 0.85, "stable"),
    demoSignal(`${base} untuk kulit sensitif`, 5400, 0.41, "up"),
    demoSignal(`${base} bpom`, 3200, 0.55, "stable"),
    demoSignal(`${base} glowing`, 8100, 0.68, "up"),
    demoSignal(`${base} fragrance free`, 2100, 0.28, "up"),
    demoSignal(`review ${base}`, 4500, 0.35, "stable"),
    demoSignal(`${base} korea`, 6700, 0.62, "down"),
    demoSignal(`${base} lokal`, 3800, 0.44, "up"),
    demoSignal(`cara pakai ${base}`, 1900, 0.22, "stable"),
  ];
}
