import type { RawKeywordSignal } from "@/lib/research/keyword-intel/collect-keywords";

export type KeywordMatrixRow = {
  keyword: string;
  volume: number;
  competition: number;
  trend: "up" | "down" | "stable" | null;
  intent: "transactional" | "informational";
  source: string[];
  /** DataForSEO mengembalikan volume untuk keyword ini. */
  hasVolumeData: boolean;
};

export type GapKeywordBase = {
  keyword: string;
  volume: number;
  competition: number;
};

function norm(keyword: string): string {
  return keyword.trim().toLowerCase();
}

function gapScore(signal: RawKeywordSignal): number {
  const volume = signal.volume ?? 0;
  const competition = Math.max(signal.competition ?? 0.5, 0.05);
  return volume / competition;
}

export function buildKeywordMatrixFromSignals(
  signals: RawKeywordSignal[],
  intents: Map<string, "transactional" | "informational"> = new Map(),
): KeywordMatrixRow[] {
  return signals.map((s) => {
    const hasVolumeData = s.sources.includes("dataforseo") && s.volume != null;
    return {
      keyword: s.keyword,
      volume: hasVolumeData ? s.volume! : 0,
      competition: hasVolumeData ? (s.competition ?? 0) : 0,
      trend: s.trend ?? null,
      intent: intents.get(norm(s.keyword)) ?? defaultIntent(s.keyword),
      source: s.sources,
      hasVolumeData,
    };
  });
}

function defaultIntent(keyword: string): "transactional" | "informational" {
  const info = /\b(cara|tips|review|apa itu|beda|vs|pengertian)\b/i;
  return info.test(keyword) ? "informational" : "transactional";
}

/** Gap hanya dari keyword dengan volume Google nyata + kompetisi rendah. */
export function buildGapKeywordsFromSignals(
  signals: RawKeywordSignal[],
): GapKeywordBase[] {
  return signals
    .filter(
      (s) =>
        s.sources.includes("dataforseo") &&
        s.volume != null &&
        s.volume > 0 &&
        (s.competition ?? 1) < 0.5,
    )
    .sort((a, b) => gapScore(b) - gapScore(a))
    .slice(0, 10)
    .map((s) => ({
      keyword: s.keyword,
      volume: s.volume!,
      competition: s.competition ?? 0,
    }));
}

export function mergeGapReasons(
  gaps: GapKeywordBase[],
  reasons: Map<string, string>,
): { keyword: string; volume: number; competition: number; reason: string }[] {
  return gaps.map((g) => ({
    ...g,
    reason:
      reasons.get(norm(g.keyword)) ??
      "Volume Google tinggi dengan kompetisi rendah — peluang listing.",
  }));
}
