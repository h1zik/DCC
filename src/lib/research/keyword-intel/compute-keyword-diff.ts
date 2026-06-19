import type {
  KeywordDiffStatus,
  NormalizedKeywordSignal,
} from "@/lib/research/keyword-intel/keyword-signal-types";

export type PriorKeywordRow = {
  keyword: string;
  koiScore: number | null;
};

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

export function applyKeywordDiff<T extends { keyword: string; koiScore?: number; diffStatus?: KeywordDiffStatus | null }>(
  current: T[],
  priorRows: PriorKeywordRow[],
): T[] {
  const matchedPrior = new Set<number>();

  return current.map((item) => {
    let priorIdx = -1;
    for (let i = 0; i < priorRows.length; i++) {
      if (matchedPrior.has(i)) continue;
      if (namesMatch(item.keyword, priorRows[i]!.keyword)) {
        priorIdx = i;
        break;
      }
    }

    if (priorIdx < 0) {
      return { ...item, diffStatus: "NEW" as const };
    }

    matchedPrior.add(priorIdx);
    const prior = priorRows[priorIdx]!;
    const priorKoi = prior.koiScore ?? 0;
    const currentKoi = item.koiScore ?? 0;
    const delta = currentKoi - priorKoi;

    if (delta > 0.1) return { ...item, diffStatus: "RISING" as const };
    if (delta < -0.1) return { ...item, diffStatus: "FADING" as const };
    return { ...item, diffStatus: "STABLE" as const };
  });
}

export function signalsToEvidence(
  signals: NormalizedKeywordSignal[],
  keyword: string,
): import("@/lib/research/keyword-intel/keyword-signal-types").KeywordEvidenceRow[] {
  return signals
    .filter((s) => s.keyword.toLowerCase() === keyword.toLowerCase())
    .map((s) => ({
      signalId: s.signalId,
      source: s.source,
      term: s.keyword,
      metric: s.metric,
      value: s.value,
      deltaPct: s.deltaPct,
      url: s.url,
      moduleHref: s.moduleHref,
    }));
}
