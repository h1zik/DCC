import type {
  TrendConfidence,
  TrendDimension,
  TrendDigestMode,
  TrendPhase,
  TrendPhaseSource,
  TrendWowStatus,
} from "@prisma/client";

export type TrendSignalSourceFamily =
  | "google_trends"
  | "rss"
  | "tiktok"
  | "bpom"
  | "review_intel"
  | "competitor"
  | "keyword_intel"
  | "social_listening";

export type NormalizedTrendSignal = {
  signalId: string;
  source: TrendSignalSourceFamily;
  term: string;
  metric: string;
  value: number;
  deltaPct?: number | null;
  url?: string | null;
  moduleHref?: string | null;
  meta?: Record<string, unknown>;
};

export type TrendSignalStats = {
  external: {
    googleTrends: number;
    rss: number;
    tiktok: number;
    bpom: number;
  };
  internal: {
    reviewIntel: number;
    competitor: number;
    keywordIntel: number;
    socialListening: number;
  };
  total: number;
  collectedAt: string;
};

export type TrendEvidenceRow = {
  signalId: string;
  source: string;
  term: string;
  metric: string;
  value: number;
  deltaPct?: number | null;
  url?: string | null;
  moduleHref?: string | null;
};

export type ClusteredTrend = {
  name: string;
  dimension: TrendDimension;
  phase: TrendPhase;
  phaseSource: TrendPhaseSource;
  tmiScore: number;
  confidence: TrendConfidence;
  isGlobalPipeline: boolean;
  evidence: TrendEvidenceRow[];
  relatedProducts: string[];
  narrative?: string;
  wowStatus?: TrendWowStatus | null;
};

export type TrendDigestQuality = {
  digestMode: TrendDigestMode;
  dataNotice: string | null;
  minSignalsForLive: number;
  minSignalsForPartial: number;
};

export const TREND_QUALITY_THRESHOLDS = {
  failedBelow: 5,
  partialBelow: 15,
} as const;

export function resolveDigestQuality(signalCount: number): TrendDigestQuality {
  if (signalCount < TREND_QUALITY_THRESHOLDS.failedBelow) {
    return {
      digestMode: "FAILED",
      dataNotice: `Hanya ${signalCount} sinyal terkumpul (minimum ${TREND_QUALITY_THRESHOLDS.failedBelow}). Periksa koneksi Google Trends, RSS, atau aktifkan modul internal Research Hub.`,
      minSignalsForLive: TREND_QUALITY_THRESHOLDS.partialBelow,
      minSignalsForPartial: TREND_QUALITY_THRESHOLDS.failedBelow,
    };
  }
  if (signalCount < TREND_QUALITY_THRESHOLDS.partialBelow) {
    return {
      digestMode: "PARTIAL",
      dataNotice: `${signalCount} sinyal — digest parsial. Confidence dibatasi; tambah sumber (TikTok, Review Intel, Keyword Intel) untuk hasil LIVE.`,
      minSignalsForLive: TREND_QUALITY_THRESHOLDS.partialBelow,
      minSignalsForPartial: TREND_QUALITY_THRESHOLDS.failedBelow,
    };
  }
  return {
    digestMode: "LIVE",
    dataNotice: null,
    minSignalsForLive: TREND_QUALITY_THRESHOLDS.partialBelow,
    minSignalsForPartial: TREND_QUALITY_THRESHOLDS.failedBelow,
  };
}

export function emptySignalStats(): TrendSignalStats {
  return {
    external: { googleTrends: 0, rss: 0, tiktok: 0, bpom: 0 },
    internal: {
      reviewIntel: 0,
      competitor: 0,
      keywordIntel: 0,
      socialListening: 0,
    },
    total: 0,
    collectedAt: new Date().toISOString(),
  };
}

/** Collapse duplicate signalId rows — keeps the highest value per id. */
export function dedupeTrendSignals(
  signals: NormalizedTrendSignal[],
): NormalizedTrendSignal[] {
  const map = new Map<string, NormalizedTrendSignal>();
  for (const s of signals) {
    const existing = map.get(s.signalId);
    if (!existing || s.value > existing.value) {
      map.set(s.signalId, s);
    }
  }
  return [...map.values()];
}

export function dedupeTrendEvidence(
  evidence: TrendEvidenceRow[],
): TrendEvidenceRow[] {
  const map = new Map<string, TrendEvidenceRow>();
  for (const row of evidence) {
    const existing = map.get(row.signalId);
    if (!existing || row.value > existing.value) {
      map.set(row.signalId, row);
    }
  }
  return [...map.values()];
}

export function evidenceToLegacySources(
  evidence: TrendEvidenceRow[],
): { type: string; snippet: string; url?: string }[] {
  return evidence.map((e) => ({
    type: e.source,
    snippet: `${e.term} (${e.metric}: ${e.value}${e.deltaPct != null ? `, ${e.deltaPct > 0 ? "+" : ""}${e.deltaPct.toFixed(0)}%` : ""})`,
    url: e.url ?? e.moduleHref ?? undefined,
  }));
}
