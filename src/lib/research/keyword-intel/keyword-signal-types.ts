export type KeywordSignalSourceFamily =
  | "shopee_autocomplete"
  | "shopee_autocomplete_apify"
  | "tokopedia_autocomplete"
  | "google_trends_top"
  | "google_trends_rising"
  | "dataforseo"
  | "shopee_search"
  | "competitor"
  | "review_intel"
  | "social_listening";

export type NormalizedKeywordSignal = {
  signalId: string;
  source: KeywordSignalSourceFamily | string;
  keyword: string;
  metric: string;
  value: number;
  deltaPct?: number | null;
  volume?: number | null;
  competition?: number | null;
  trend?: "up" | "down" | "stable" | null;
  listingSampleCount?: number | null;
  medianPrice?: number | null;
  url?: string | null;
  moduleHref?: string | null;
  meta?: Record<string, unknown>;
};

export type KeywordSignalStats = {
  external: {
    shopee: number;
    tokopedia: number;
    googleTrends: number;
    dataforseo: number;
    shopeeSearch: number;
  };
  internal: {
    competitor: number;
    reviewIntel: number;
    socialListening: number;
  };
  total: number;
  collectedAt: string;
};

export type KeywordEvidenceRow = {
  signalId: string;
  source: string;
  term: string;
  metric: string;
  value: number;
  deltaPct?: number | null;
  url?: string | null;
  moduleHref?: string | null;
};

export type KeywordConfidence = "HIGH" | "MED" | "LOW";

export type KeywordDiffStatus = "NEW" | "RISING" | "STABLE" | "FADING";

export type KeywordMatrixRow = {
  keyword: string;
  volume: number;
  competition: number;
  trend: "up" | "down" | "stable" | null;
  intent: "transactional" | "informational";
  source: string[];
  hasVolumeData: boolean;
  koiScore?: number;
  confidence?: KeywordConfidence;
  evidence?: KeywordEvidenceRow[];
  listingSampleCount?: number | null;
  medianPrice?: number | null;
  diffStatus?: KeywordDiffStatus | null;
};

export type GapKeywordRow = {
  keyword: string;
  volume: number;
  competition: number;
  koiScore: number;
  confidence: KeywordConfidence;
  reason: string;
  listingSampleCount?: number | null;
};

export type SeasonalCurvePoint = {
  month: string;
  volume?: number;
  index?: number;
};

export type SeasonalCurve = {
  keyword: string;
  source: "dataforseo" | "google_trends";
  months: SeasonalCurvePoint[];
};

export type KeywordDataQuality = {
  dataNotice: string | null;
  volumeSource: "dataforseo" | "marketplace_proxy" | "unavailable";
};

/** @deprecated use KeywordDataQuality */
export type KeywordDigestQuality = KeywordDataQuality;

export const KEYWORD_QUALITY_THRESHOLDS = {
  lowSignalNoticeBelow: 5,
  lowVolumeNoticeBelow: 15,
} as const;

export function emptyKeywordSignalStats(): KeywordSignalStats {
  return {
    external: {
      shopee: 0,
      tokopedia: 0,
      googleTrends: 0,
      dataforseo: 0,
      shopeeSearch: 0,
    },
    internal: {
      competitor: 0,
      reviewIntel: 0,
      socialListening: 0,
    },
    total: 0,
    collectedAt: new Date().toISOString(),
  };
}

export function resolveKeywordQuality(input: {
  signalCount: number;
  volumeKeywordCount: number;
}): KeywordDataQuality {
  const { signalCount, volumeKeywordCount } = input;
  const notices: string[] = [];

  if (signalCount < KEYWORD_QUALITY_THRESHOLDS.lowSignalNoticeBelow) {
    notices.push(
      `Hanya ${signalCount} sinyal terkumpul. Periksa Shopee autocomplete, Google Trends, dan DataForSEO.`,
    );
  } else if (
    volumeKeywordCount < KEYWORD_QUALITY_THRESHOLDS.lowVolumeNoticeBelow
  ) {
    notices.push(
      `${signalCount} sinyal — ${volumeKeywordCount} keyword dengan volume Google.`,
    );
  }

  return {
    dataNotice: notices.length > 0 ? notices.join(" ") : null,
    volumeSource:
      volumeKeywordCount > 0 ? "dataforseo" : "unavailable",
  };
}

export function signalId(
  source: string,
  keyword: string,
  metric: string,
): string {
  return `${source}:${keyword.toLowerCase().trim()}:${metric}`;
}

export function dedupeKeywordEvidence(
  evidence: KeywordEvidenceRow[],
): KeywordEvidenceRow[] {
  const map = new Map<string, KeywordEvidenceRow>();
  for (const row of evidence) {
    const existing = map.get(row.signalId);
    if (!existing || row.value > existing.value) {
      map.set(row.signalId, row);
    }
  }
  return [...map.values()];
}

export function normKeyword(keyword: string): string {
  return keyword.trim().toLowerCase();
}
