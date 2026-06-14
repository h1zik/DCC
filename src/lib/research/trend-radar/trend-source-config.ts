import "server-only";

import { z } from "zod";
import { getDefaultRssFeedEntries } from "@/lib/research/trend-radar/rss-feeds";
import {
  normalizeHashtags,
  type TrendSourceConfig,
} from "@/lib/research/trend-radar/trend-source-config-types";

export type {
  TrendRssFeedEntry,
  TrendSourceConfig,
  TrendSourceEnabled,
} from "@/lib/research/trend-radar/trend-source-config-types";

export {
  enabledRssFeedUrls,
  normalizeHashtags,
  parseHashtagInput,
  summarizeEnabledSources,
} from "@/lib/research/trend-radar/trend-source-config-types";

const rssFeedEntrySchema = z.object({
  url: z.string().url().max(500),
  label: z.string().max(120).optional(),
  enabled: z.boolean(),
});

export const trendSourceConfigSchema = z
  .object({
    enabled: z.object({
      googleTrends: z.boolean(),
      rss: z.boolean(),
      tiktok: z.boolean(),
      bpom: z.boolean(),
    }),
    rssFeeds: z.array(rssFeedEntrySchema).max(20),
    tiktokHashtags: z.array(z.string().min(1).max(80)).max(20),
  })
  .superRefine((cfg, ctx) => {
    const anyEnabled = Object.values(cfg.enabled).some(Boolean);
    if (!anyEnabled) {
      ctx.addIssue({
        code: "custom",
        message: "Minimal satu sumber harus diaktifkan.",
      });
    }
    if (cfg.enabled.rss && !cfg.rssFeeds.some((f) => f.enabled)) {
      ctx.addIssue({
        code: "custom",
        message: "RSS aktif — pilih minimal satu feed.",
        path: ["rssFeeds"],
      });
    }
    if (cfg.enabled.tiktok && cfg.tiktokHashtags.length === 0) {
      ctx.addIssue({
        code: "custom",
        message: "TikTok aktif — isi minimal satu hashtag.",
        path: ["tiktokHashtags"],
      });
    }
  });

export function getDefaultTrendSourceConfig(): TrendSourceConfig {
  return {
    enabled: {
      googleTrends: true,
      rss: true,
      tiktok: false,
      bpom: true,
    },
    rssFeeds: getDefaultRssFeedEntries(),
    tiktokHashtags: [],
  };
}

export function resolveTrendSourceConfig(
  override?: Partial<TrendSourceConfig> | null,
): TrendSourceConfig {
  const base = getDefaultTrendSourceConfig();
  if (!override) return base;

  return {
    enabled: { ...base.enabled, ...override.enabled },
    rssFeeds: override.rssFeeds?.length ? override.rssFeeds : base.rssFeeds,
    tiktokHashtags:
      override.tiktokHashtags !== undefined
        ? normalizeHashtags(override.tiktokHashtags)
        : base.tiktokHashtags,
  };
}

export function validateTrendSourceConfig(
  config: unknown,
): TrendSourceConfig {
  const parsed = trendSourceConfigSchema.parse(config);
  return {
    ...parsed,
    tiktokHashtags: normalizeHashtags(parsed.tiktokHashtags),
  };
}

export function parseTrendSourceConfigJson(
  value: unknown,
): TrendSourceConfig | null {
  if (!value || typeof value !== "object") return null;
  try {
    return validateTrendSourceConfig(value);
  } catch {
    return null;
  }
}
