import "server-only";

import { prisma } from "@/lib/prisma";
import { buildVisualLibraryGroups } from "@/lib/brand-research/visual";
import type {
  StrategyGenerationConfig,
  StrategySourceCatalog,
} from "@/lib/brand-research/strategy/evidence-types";
import {
  countSelectedVisualAssets,
  defaultVisualSourceIds,
} from "@/lib/brand-research/strategy/strategy-visual-config";
import {
  listResearchCompetitorsForBrandHub,
  listResearchKeywordQueriesForBrandHub,
  listResearchReviewSourcesForBrandHub,
  listResearchSocialMonitorsForBrandHub,
  listResearchTrendDigestsForBrandHub,
  listResearchUspAnalysesForBrandHub,
} from "@/lib/brand-research/research-hub-readers";

export async function getStrategySourceCatalog(
  userId: string,
  ownerBrandId?: string | null,
): Promise<StrategySourceCatalog> {
  const [
    reviewSources,
    socialMonitors,
    competitors,
    keywordQueries,
    trendDigests,
    uspAnalyses,
  ] = await Promise.all([
    listResearchReviewSourcesForBrandHub(),
    listResearchSocialMonitorsForBrandHub(),
    listResearchCompetitorsForBrandHub(),
    listResearchKeywordQueriesForBrandHub(),
    listResearchTrendDigestsForBrandHub(),
    listResearchUspAnalysesForBrandHub(),
  ]);

  const groups = await buildVisualLibraryGroups(userId, ownerBrandId);
  const visual = {
    assetCount:
      groups.pinterest.reduce((n, p) => n + p.assets.length, 0) +
      groups.competitors.reduce((n, c) => n + c.assets.length, 0) +
      groups.socialMonitors.reduce((n, m) => n + m.assets.length, 0) +
      groups.manual.length,
    pinterest: groups.pinterest.map(({ collection, assets }) => ({
      id: collection.id,
      label: collection.name,
      count: assets.length,
      detail: collection.keywords.join(", ") || undefined,
    })),
    competitor: groups.competitors.map((c) => ({
      id: c.competitorId,
      label: c.name,
      count: c.assets.length,
    })),
    social: groups.socialMonitors.map((m) => ({
      id: m.monitorId,
      label: m.name,
      count: m.assets.length,
    })),
    manualCount: groups.manual.length,
  };

  return {
    review: reviewSources.map((s) => ({
      id: s.id,
      label: `${s.productName} (${s.competitorBrand})`,
    })),
    social: socialMonitors
      .filter((m) => m.batches.length > 0)
      .map((m) => ({ id: m.id, label: m.name })),
    competitor: competitors
      .filter((c) => c.isActive)
      .map((c) => ({
        id: c.id,
        label: `${c.brand} — ${c.name}`,
      })),
    keyword: keywordQueries.map((q) => ({
      id: q.id,
      label: q.seedKeyword ?? q.category,
    })),
    trend: trendDigests.map((d) => ({
      id: d.id,
      label: d.isGlobal ? "Digest global" : "Digest brand",
      detail: d.narrative?.slice(0, 80) ?? undefined,
    })),
    usp: uspAnalyses.map((u) => ({
      id: u.id,
      label: u.category,
    })),
    visual,
  };
}

export function defaultStrategyGenerationConfig(
  catalog: StrategySourceCatalog,
): StrategyGenerationConfig {
  return {
    review: { enabled: catalog.review.length > 0, ids: catalog.review.map((r) => r.id) },
    social: { enabled: catalog.social.length > 0, ids: catalog.social.map((s) => s.id) },
    visual: {
      enabled: catalog.visual.assetCount > 0,
      ids: defaultVisualSourceIds(catalog.visual),
      analyzeImages: catalog.visual.assetCount > 0,
      maxSamples: 12,
    },
    competitor: {
      enabled: catalog.competitor.length > 0,
      ids: catalog.competitor.map((c) => c.id),
    },
    keyword: { enabled: catalog.keyword.length > 0, ids: catalog.keyword.map((k) => k.id) },
    trend: { enabled: catalog.trend.length > 0, ids: catalog.trend.map((t) => t.id) },
    usp: { enabled: catalog.usp.length > 0, ids: catalog.usp.map((u) => u.id) },
  };
}

export function parseStrategyGenerationConfig(raw: unknown): StrategyGenerationConfig | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as StrategyGenerationConfig;
  if (!o.review || !o.visual) return null;
  return o;
}

export function validateStrategyGenerationConfig(
  config: StrategyGenerationConfig,
  catalog: StrategySourceCatalog,
): { ok: boolean; message?: string } {
  const reviewOk =
    !config.review.enabled ||
    config.review.ids.some((id) => catalog.review.some((r) => r.id === id));
  const socialOk =
    !config.social.enabled ||
    config.social.ids.some((id) => catalog.social.some((s) => s.id === id));
  const visualOk =
    !config.visual.enabled ||
    countSelectedVisualAssets(catalog.visual, config.visual) > 0;
  const competitorOk =
    !config.competitor.enabled ||
    config.competitor.ids.some((id) => catalog.competitor.some((c) => c.id === id));

  const hasVoice =
    (config.review.enabled &&
      config.review.ids.length > 0 &&
      catalog.review.some((r) => config.review.ids.includes(r.id))) ||
    (config.social.enabled &&
      config.social.ids.length > 0 &&
      catalog.social.some((s) => config.social.ids.includes(s.id)));

  const selectedVisualCount = countSelectedVisualAssets(
    catalog.visual,
    config.visual,
  );
  const hasVisualOrCompetitor =
    (config.visual.enabled && selectedVisualCount >= 5) ||
    (config.competitor.enabled &&
      config.competitor.ids.length > 0 &&
      catalog.competitor.some((c) => config.competitor.ids.includes(c.id)));

  if (!reviewOk || !socialOk || !visualOk || !competitorOk) {
    return { ok: false, message: "Konfigurasi sumber tidak valid." };
  }
  if (!hasVoice) {
    return {
      ok: false,
      message: "Pilih minimal Review Intel atau Social Listening.",
    };
  }
  if (!hasVisualOrCompetitor) {
    return {
      ok: false,
      message: "Pilih Visual Library (≥5 asset) atau Competitor Tracker.",
    };
  }
  return { ok: true };
}
