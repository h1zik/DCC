import "server-only";

import { TrendWowStatus } from "@prisma/client";
import type { ClusteredTrend } from "@/lib/research/trend-radar/trend-signal-types";

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSet(name: string): Set<string> {
  return new Set(
    normalizeName(name)
      .split(" ")
      .filter((t) => t.length > 2),
  );
}

function namesMatch(a: string, b: string): boolean {
  const ta = tokenSet(a);
  const tb = tokenSet(b);
  if (ta.size === 0 || tb.size === 0) return false;
  let inter = 0;
  for (const t of ta) {
    if (tb.has(t)) inter += 1;
  }
  return inter / Math.min(ta.size, tb.size) >= 0.4;
}

export type PriorTrendItem = {
  name: string;
  tmiScore: number | null;
};

export function applyWowDiff(
  current: ClusteredTrend[],
  priorItems: PriorTrendItem[],
): ClusteredTrend[] {
  const matchedPrior = new Set<number>();

  return current.map((item) => {
    let priorIdx = -1;
    for (let i = 0; i < priorItems.length; i++) {
      if (matchedPrior.has(i)) continue;
      if (namesMatch(item.name, priorItems[i]!.name)) {
        priorIdx = i;
        break;
      }
    }

    if (priorIdx < 0) {
      return { ...item, wowStatus: TrendWowStatus.NEW };
    }

    matchedPrior.add(priorIdx);
    const prior = priorItems[priorIdx]!;
    const priorTmi = prior.tmiScore ?? 0;
    const delta = item.tmiScore - priorTmi;

    if (delta > 0.1) {
      return { ...item, wowStatus: TrendWowStatus.ACCELERATING };
    }
    if (delta < -0.1) {
      return { ...item, wowStatus: TrendWowStatus.FADING };
    }
    return { ...item, wowStatus: TrendWowStatus.STABLE };
  });
}

export function goneTrendNames(
  current: ClusteredTrend[],
  priorItems: PriorTrendItem[],
): string[] {
  const gone: string[] = [];
  for (const prior of priorItems) {
    if (!current.some((c) => namesMatch(c.name, prior.name))) {
      gone.push(prior.name);
    }
  }
  return gone;
}
