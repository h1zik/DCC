export type KeywordSourceEnabled = {
  googleTrends: boolean;
  marketplaceAutocomplete: boolean;
  dataforseo: boolean;
  shopeeSearch: boolean;
  competitor: boolean;
  reviewIntel: boolean;
  socialListening: boolean;
};

/** Sumber yang ditampilkan & diizinkan di Keyword Intel. */
export const KEYWORD_INTEL_ACTIVE_SOURCES = [
  "marketplaceAutocomplete",
  "googleTrends",
  "dataforseo",
] as const satisfies readonly (keyof KeywordSourceEnabled)[];

export type KeywordSourceConfig = {
  enabled: KeywordSourceEnabled;
};

export const DEFAULT_CATEGORY_PRESETS = [
  "body serum brightening",
  "sunscreen wajah SPF50",
  "deodorant natural",
  "serum niacinamide",
  "body lotion whitening",
  "parfum body mist",
] as const;

export function summarizeEnabledKeywordSources(
  config: KeywordSourceConfig,
): string[] {
  const labels: string[] = [];
  if (config.enabled.marketplaceAutocomplete) labels.push("Shopee autocomplete");
  if (config.enabled.googleTrends) labels.push("Google Trends");
  if (config.enabled.dataforseo) labels.push("DataForSEO");
  return labels;
}

/** Matikan sumber di luar kebijakan produk. */
export function enforceKeywordSourcePolicy(
  config: KeywordSourceConfig,
): KeywordSourceConfig {
  return {
    enabled: {
      ...config.enabled,
      shopeeSearch: false,
      competitor: false,
      reviewIntel: false,
      socialListening: false,
    },
  };
}

export function normalizeKeywordSourceConfig(
  raw: Partial<KeywordSourceConfig> | null | undefined,
  defaults: KeywordSourceConfig,
): KeywordSourceConfig {
  if (!raw) return defaults;
  return {
    enabled: {
      ...defaults.enabled,
      ...(raw.enabled ?? {}),
    },
  };
}
