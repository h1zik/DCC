import { describe, expect, it } from "vitest";
import {
  enrichKeywordVolumeMetrics,
  inferProxyCompetition,
  inferProxyVolume,
} from "@/lib/research/keyword-intel/keyword-volume-proxy";
import type { NormalizedKeywordSignal } from "@/lib/research/keyword-intel/keyword-signal-types";

function signal(
  partial: Partial<NormalizedKeywordSignal> & Pick<NormalizedKeywordSignal, "source" | "keyword">,
): NormalizedKeywordSignal {
  return {
    signalId: `${partial.source}:${partial.keyword}:test`,
    metric: "autocomplete",
    value: 1,
    ...partial,
  };
}

describe("keyword-volume-proxy", () => {
  it("estimates higher volume for top autocomplete ranks", () => {
    expect(
      inferProxyVolume(signal({ source: "shopee_autocomplete", keyword: "a", meta: { rank: 1 } })),
    ).toBeGreaterThan(
      inferProxyVolume(signal({ source: "shopee_autocomplete", keyword: "b", meta: { rank: 15 } })),
    );
  });

  it("fills missing metrics for autocomplete-only keywords", () => {
    const [enriched] = enrichKeywordVolumeMetrics([
      signal({
        source: "shopee_autocomplete",
        keyword: "lip serum",
        meta: { rank: 3 },
      }),
    ]);

    expect(enriched?.volume).toBeGreaterThan(0);
    expect(enriched?.competition).toBeGreaterThan(0);
    expect(enriched?.meta?.volume_proxy).toBe(true);
  });

  it("keeps positive Google volume from DataForSEO", () => {
    const [enriched] = enrichKeywordVolumeMetrics([
      signal({
        source: "dataforseo",
        keyword: "lip serum",
        volume: 5000,
        competition: 0.4,
        value: 5000,
        metric: "search_volume",
      }),
    ]);

    expect(enriched?.volume).toBe(5000);
    expect(enriched?.meta?.volume_proxy).toBeUndefined();
  });
});

describe("inferProxyCompetition", () => {
  it("uses listing sample count when available", () => {
    expect(
      inferProxyCompetition(
        signal({
          source: "shopee_search",
          keyword: "x",
          listingSampleCount: 20,
        }),
      ),
    ).toBeCloseTo(0.833, 2);
  });
});
