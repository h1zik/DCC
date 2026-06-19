import type { NormalizedKeywordSignal } from "@/lib/research/keyword-intel/keyword-signal-types";
import { computeKoiForKeyword } from "@/lib/research/keyword-intel/compute-koi";
import { signalsToEvidence } from "@/lib/research/keyword-intel/compute-keyword-diff";
import type {
  GapKeywordRow,
  KeywordConfidence,
  KeywordMatrixRow,
} from "@/lib/research/keyword-intel/keyword-signal-types";

export type GapKeywordBase = {
  keyword: string;
  volume: number;
  competition: number;
};

function norm(keyword: string): string {
  return keyword.trim().toLowerCase();
}

function defaultIntent(keyword: string): "transactional" | "informational" {
  const info = /\b(cara|tips|review|apa itu|beda|vs|pengertian)\b/i;
  return info.test(keyword) ? "informational" : "transactional";
}

function sourceFamilyCount(signals: NormalizedKeywordSignal[]): number {
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
  return families.size;
}

export function buildKeywordMatrixFromSignals(
  signals: NormalizedKeywordSignal[],
  intents: Map<string, "transactional" | "informational"> = new Map(),
  opts: { allSignals: NormalizedKeywordSignal[] },
): KeywordMatrixRow[] {
  const uniqueKeywords = [...new Set(signals.map((s) => s.keyword.trim()).filter(Boolean))];

  return uniqueKeywords.map((keyword) => {
    const keywordSignals = opts.allSignals.filter(
      (s) => s.keyword.toLowerCase() === keyword.toLowerCase(),
    );
    const hasVolumeData = keywordSignals.some(
      (s) => s.source === "dataforseo" && s.volume != null,
    );
    const volume =
      keywordSignals.find((s) => s.volume != null)?.volume ??
      (hasVolumeData ? 0 : 0);
    const competition =
      keywordSignals.find((s) => s.competition != null)?.competition ?? 0;
    const trend = keywordSignals.find((s) => s.trend)?.trend ?? null;
    const listingSampleCount =
      keywordSignals.find((s) => s.listingSampleCount != null)?.listingSampleCount ??
      null;
    const medianPrice =
      keywordSignals.find((s) => s.medianPrice != null)?.medianPrice ?? null;

    const { koiScore, confidence } = computeKoiForKeyword({
      keyword,
      signals: keywordSignals,
    });

    const sources = [
      ...new Set(keywordSignals.map((s) => s.source)),
    ];

    return {
      keyword,
      volume: hasVolumeData ? volume : 0,
      competition: hasVolumeData ? competition : 0,
      trend,
      intent: intents.get(norm(keyword)) ?? defaultIntent(keyword),
      source: sources,
      hasVolumeData,
      koiScore,
      confidence,
      evidence: signalsToEvidence(opts.allSignals, keyword),
      listingSampleCount,
      medianPrice,
    };
  });
}

export function buildGapKeywordsFromMatrix(
  matrix: KeywordMatrixRow[],
  allSignals: NormalizedKeywordSignal[],
): GapKeywordRow[] {
  return matrix
    .filter((row) => {
      const families = sourceFamilyCount(
        allSignals.filter((s) => s.keyword.toLowerCase() === row.keyword.toLowerCase()),
      );
      const lowSaturation =
        row.listingSampleCount == null || row.listingSampleCount <= 12;
      return (
        (row.hasVolumeData ? row.volume > 0 && row.competition < 0.55 : families >= 2) &&
        lowSaturation &&
        (row.koiScore ?? 0) >= 0.35
      );
    })
    .sort((a, b) => (b.koiScore ?? 0) - (a.koiScore ?? 0))
    .slice(0, 10)
    .map((row) => ({
      keyword: row.keyword,
      volume: row.volume,
      competition: row.competition,
      koiScore: row.koiScore ?? 0,
      confidence: (row.confidence ?? "LOW") as KeywordConfidence,
      reason: "Peluang keyword — volume dan saturasi marketplace menguntungkan.",
      listingSampleCount: row.listingSampleCount,
    }));
}

export function mergeGapReasons(
  gaps: GapKeywordRow[],
  reasons: Map<string, string>,
): GapKeywordRow[] {
  return gaps.map((g) => ({
    ...g,
    reason:
      reasons.get(norm(g.keyword)) ??
      g.reason ??
      "Volume Google tinggi dengan kompetisi rendah — peluang listing.",
  }));
}

/** @deprecated use buildGapKeywordsFromMatrix */
export function buildGapKeywordsFromSignals(
  signals: NormalizedKeywordSignal[],
): GapKeywordBase[] {
  const matrix = buildKeywordMatrixFromSignals(signals, new Map(), {
    allSignals: signals,
  });
  return buildGapKeywordsFromMatrix(matrix, signals).map((g) => ({
    keyword: g.keyword,
    volume: g.volume,
    competition: g.competition,
  }));
}
