import "server-only";

import { TrendPhase } from "@prisma/client";
import type { CollectedTrendRaw } from "@/lib/research/trend-radar/collect-sources";
import { normalizeTrendPhase } from "@/lib/research/trend-radar/normalize-trend";

export type PhaseEnrichableItem = {
  name: string;
  phase: TrendPhase | string;
  score?: number;
  [key: string]: unknown;
};

function termMatches(a: string, b: string): boolean {
  const x = a.toLowerCase().trim();
  const y = b.toLowerCase().trim();
  if (!x || !y) return false;
  return x === y || x.includes(y) || y.includes(x);
}

function buildSignalIndex(signals: CollectedTrendRaw["signals"]) {
  const risingTerms: string[] = [];
  const volumes: { term: string; value: number }[] = [];

  for (const s of signals) {
    const term = s.term.toLowerCase().trim();
    if (!term) continue;
    if (s.meta?.rising === true) risingTerms.push(term);
    const value = Number(s.meta?.value ?? 0);
    if (Number.isFinite(value) && value > 0) {
      volumes.push({ term, value });
    }
  }

  volumes.sort((a, b) => b.value - a.value);
  const peakCutoff =
    volumes[Math.max(0, Math.floor(volumes.length * 0.25) - 1)]?.value ?? 0;
  const declineCutoff =
    volumes[Math.floor(volumes.length * 0.75)]?.value ?? 0;

  return { risingTerms, volumes, peakCutoff, declineCutoff };
}

/** Infer phase dari metadata Google Trends / sinyal lain. */
export function inferPhaseForTrend(
  item: PhaseEnrichableItem,
  index: ReturnType<typeof buildSignalIndex>,
): TrendPhase {
  const name = item.name.toLowerCase();
  let maxVol = 0;
  let hasRisingMatch = false;

  for (const v of index.volumes) {
    if (termMatches(name, v.term)) {
      maxVol = Math.max(maxVol, v.value);
    }
  }
  for (const r of index.risingTerms) {
    if (termMatches(name, r)) hasRisingMatch = true;
  }

  if (hasRisingMatch) return TrendPhase.EMERGING;
  if (maxVol > 0 && index.peakCutoff > 0 && maxVol >= index.peakCutoff) {
    return TrendPhase.PEAK;
  }
  if (
    maxVol > 0 &&
    index.declineCutoff > 0 &&
    maxVol <= index.declineCutoff &&
    index.volumes.length >= 6
  ) {
    return TrendPhase.DECLINING;
  }

  return normalizeTrendPhase(item.phase);
}

/** Setelah inferensi, pastikan tidak semua tren di satu kolom fase. */
export function rebalancePhasesIfFlat<T extends PhaseEnrichableItem>(
  items: T[],
): T[] {
  if (items.length < 4) return items;

  const phases = new Set(items.map((i) => normalizeTrendPhase(i.phase)));
  if (phases.size >= 3) return items;

  const sorted = [...items].sort(
    (a, b) => (Number(b.score) || 0) - (Number(a.score) || 0),
  );
  const n = sorted.length;
  const quotas: { phase: TrendPhase; count: number }[] = [
    { phase: TrendPhase.PEAK, count: Math.max(1, Math.round(n * 0.25)) },
    { phase: TrendPhase.GROWING, count: Math.max(1, Math.round(n * 0.35)) },
    { phase: TrendPhase.EMERGING, count: Math.max(1, Math.round(n * 0.25)) },
    { phase: TrendPhase.DECLINING, count: Math.max(1, Math.round(n * 0.15)) },
  ];

  const assignment = new Map<string, TrendPhase>();
  let idx = 0;
  for (const { phase, count } of quotas) {
    for (let i = 0; i < count && idx < n; i += 1, idx += 1) {
      assignment.set(sorted[idx]!.name, phase);
    }
  }
  while (idx < n) {
    assignment.set(sorted[idx]!.name, TrendPhase.GROWING);
    idx += 1;
  }

  return items.map((item) => ({
    ...item,
    phase: assignment.get(item.name) ?? normalizeTrendPhase(item.phase),
  }));
}

export function enrichTrendPhases<T extends PhaseEnrichableItem>(
  items: T[],
  signals: CollectedTrendRaw["signals"],
): T[] {
  const index = buildSignalIndex(signals);
  const inferred = items.map((item) => ({
    ...item,
    phase: inferPhaseForTrend(item, index),
  }));
  return rebalancePhasesIfFlat(inferred);
}
