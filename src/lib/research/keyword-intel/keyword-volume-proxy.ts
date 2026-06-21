import "server-only";

import type { NormalizedKeywordSignal } from "@/lib/research/keyword-intel/keyword-signal-types";

/** Estimasi volume dari rank Shopee autocomplete / sinyal marketplace. */
export function inferProxyVolume(signal: NormalizedKeywordSignal): number {
  const rank = Number(signal.meta?.rank);
  if (Number.isFinite(rank) && rank > 0) {
    return Math.max(50, Math.round(18_000 / rank));
  }

  if (signal.metric === "related_query" && signal.value > 0) {
    return Math.max(50, Math.round(signal.value * 180));
  }

  if (signal.metric === "autocomplete" && signal.value > 1) {
    return Math.max(50, Math.round(signal.value * 900));
  }

  if (signal.listingSampleCount != null && signal.listingSampleCount > 0) {
    return Math.max(50, signal.listingSampleCount * 120);
  }

  return 100;
}

/** Estimasi kompetisi 0–1 dari saturasi marketplace / rank autocomplete. */
export function inferProxyCompetition(signal: NormalizedKeywordSignal): number {
  if (signal.listingSampleCount != null && signal.listingSampleCount >= 0) {
    return Math.min(0.95, Math.max(0.05, signal.listingSampleCount / 24));
  }

  const rank = Number(signal.meta?.rank);
  if (Number.isFinite(rank) && rank > 0) {
    return Math.min(0.9, Math.max(0.15, 0.18 + rank * 0.032));
  }

  return 0.45;
}

function usesGoogleVolume(signal: NormalizedKeywordSignal): boolean {
  return (
    signal.source === "dataforseo" &&
    signal.volume != null &&
    signal.volume > 0 &&
    signal.meta?.volume_proxy !== true
  );
}

/** Isi volume & kompetisi untuk keyword yang belum punya data Google. */
export function enrichKeywordVolumeMetrics(
  signals: NormalizedKeywordSignal[],
): NormalizedKeywordSignal[] {
  return signals.map((signal) => {
    const googleVolume =
      signal.source === "dataforseo" && signal.volume != null
        ? signal.volume
        : null;

    if (usesGoogleVolume(signal)) {
      return {
        ...signal,
        competition: signal.competition ?? inferProxyCompetition(signal),
      };
    }

    const volume =
      googleVolume != null && googleVolume > 0
        ? googleVolume
        : inferProxyVolume(signal);
    const competition = signal.competition ?? inferProxyCompetition(signal);

    return {
      ...signal,
      volume,
      competition,
      value: volume,
      meta: {
        ...signal.meta,
        volume_proxy: googleVolume == null || googleVolume === 0,
      },
    };
  });
}

export function countGoogleVolumeKeywords(
  signals: NormalizedKeywordSignal[],
): number {
  return signals.filter((s) => usesGoogleVolume(s)).length;
}

export function countProxyVolumeKeywords(
  signals: NormalizedKeywordSignal[],
): number {
  return signals.filter((s) => s.meta?.volume_proxy === true).length;
}
