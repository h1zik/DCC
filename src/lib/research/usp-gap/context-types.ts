/** Shared types for USP context — safe to import from client components. */

export type ContextModuleToggles = {
  reviewIntel?: boolean;
  competitor?: boolean;
  trendRadar?: boolean;
  keywordIntel?: boolean;
  socialListening?: boolean;
  productDiscovery?: boolean;
  competitorProducts?: boolean;
};

export type ContextSourceIds = {
  reviewSourceIds?: string[];
  competitorIds?: string[];
  trendDigestId?: string;
  keywordQueryId?: string;
  socialMonitorId?: string;
  productDiscoveryQueryIds?: string[];
  competitorProductCategoryIds?: string[];
};

export type ContextModules = ContextModuleToggles & ContextSourceIds;

export type ResolvedSourceRef = {
  id: string;
  label: string;
  href: string;
  meta?: string;
};

export type ResolvedContextSources = {
  reviewIntel?: ResolvedSourceRef[];
  competitor?: ResolvedSourceRef[];
  trendRadar?: ResolvedSourceRef;
  keywordIntel?: ResolvedSourceRef;
  socialListening?: ResolvedSourceRef;
  productDiscovery?: ResolvedSourceRef[];
  competitorProducts?: ResolvedSourceRef[];
};

export type ContextMatchKind = "matched" | "fallback";

/**
 * Per-module relevance of the data that was actually attached:
 * - "matched": data confirmed to match the analysis category (or user-picked).
 * - "fallback": no category match found, so the most-recent records were used
 *   regardless of category — relevance is NOT guaranteed.
 */
export type ContextMatchQuality = Partial<
  Record<keyof ResolvedContextSources, ContextMatchKind>
>;

/** Persisted on UspGapAnalysis.contextModules after each run. */
export type StoredContextModules = ContextModules & {
  resolvedSources?: ResolvedContextSources;
  matchQuality?: ContextMatchQuality;
};

export type ContextSourceOption = {
  id: string;
  label: string;
  meta: string;
};

export type UspContextSourceOptions = {
  reviewSources: ContextSourceOption[];
  competitors: ContextSourceOption[];
  trendDigests: ContextSourceOption[];
  keywordQueries: ContextSourceOption[];
  socialMonitors: ContextSourceOption[];
  productDiscoveryQueries: ContextSourceOption[];
  competitorProductCategories: ContextSourceOption[];
};

export type SuggestedContextSourceIds = {
  reviewSourceIds: string[];
  competitorIds: string[];
  trendDigestId: string | null;
  keywordQueryId: string | null;
  socialMonitorId: string | null;
  productDiscoveryQueryIds: string[];
  competitorProductCategoryIds: string[];
};
