import "server-only";

import type {
  KeywordConfidence,
  NormalizedKeywordSignal,
} from "@/lib/research/keyword-intel/keyword-signal-types";

const WEIGHTS = {
  search: 0.3,
  marketplace: 0.25,
  trend: 0.2,
  consumer: 0.15,
  gap: 0.1,
} as const;

function sourceFamilies(signals: NormalizedKeywordSignal[]): Set<string> {
  const families = new Set<string>();
  for (const s of signals) {
    if (s.source.includes("google") || s.source === "dataforseo") families.add("search");
    else if (s.source.includes("shopee") || s.source.includes("tokopedia")) {
      families.add("marketplace");
    } else if (s.source === "competitor") families.add("competitor");
    else if (s.source === "review_intel" || s.source === "social_listening") {
      families.add("consumer");
    }
  }
  return families;
}

function scoreVolume(volume: number | null | undefined): number {
  if (volume == null || volume <= 0) return 0;
  return Math.min(1, Math.log10(volume + 1) / 5);
}

function scoreSaturation(listingSampleCount: number | null | undefined): number {
  if (listingSampleCount == null) return 0.5;
  if (listingSampleCount <= 5) return 1;
  if (listingSampleCount >= 24) return 0.15;
  return 1 - listingSampleCount / 30;
}

function scoreTrend(trend: NormalizedKeywordSignal["trend"]): number {
  if (trend === "up") return 1;
  if (trend === "down") return 0.2;
  return 0.55;
}

function scoreConsumer(signals: NormalizedKeywordSignal[]): number {
  const vals = signals
    .filter((s) => s.source === "review_intel" || s.source === "social_listening")
    .map((s) => s.value);
  if (vals.length === 0) return 0;
  const max = Math.max(...vals);
  return Math.min(1, Math.log10(max + 1) / 3);
}

function scoreGapFit(
  volume: number | null | undefined,
  competition: number | null | undefined,
  saturation: number,
): number {
  const vol = scoreVolume(volume);
  const comp = competition ?? 0.5;
  return vol * (1 - comp) * saturation;
}

export function computeKoiForKeyword(input: {
  keyword: string;
  signals: NormalizedKeywordSignal[];
}): { koiScore: number; confidence: KeywordConfidence } {
  const keywordSignals = input.signals.filter(
    (s) => s.keyword.toLowerCase() === input.keyword.toLowerCase(),
  );
  const allSignals = keywordSignals.length > 0 ? keywordSignals : input.signals;

  const volume = allSignals.find((s) => s.volume != null)?.volume ?? null;
  const competition = allSignals.find((s) => s.competition != null)?.competition ?? null;
  const trend = allSignals.find((s) => s.trend)?.trend ?? null;
  const listingSampleCount = allSignals.find((s) => s.listingSampleCount != null)
    ?.listingSampleCount;

  const saturation = scoreSaturation(listingSampleCount);
  const raw =
    scoreVolume(volume) * WEIGHTS.search +
    saturation * WEIGHTS.marketplace +
    scoreTrend(trend) * WEIGHTS.trend +
    scoreConsumer(allSignals) * WEIGHTS.consumer +
    scoreGapFit(volume, competition, saturation) * WEIGHTS.gap;

  const koiScore = Math.min(1, Math.max(0, raw));
  const families = sourceFamilies(allSignals);
  const hasNumeric = allSignals.some((s) => s.value > 0 && s.metric !== "autocomplete");

  let confidence: KeywordConfidence = "LOW";
  if (families.size >= 3 && hasNumeric) {
    confidence = "HIGH";
  } else if (families.size >= 2) {
    confidence = "MED";
  }

  return { koiScore, confidence };
}

export function preliminaryKeywordScore(signal: NormalizedKeywordSignal): number {
  return (signal.volume ?? 0) + signal.value * 10;
}
