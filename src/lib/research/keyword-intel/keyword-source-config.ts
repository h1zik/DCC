import "server-only";

import { z } from "zod";
import { isDataForSeoConfigured } from "@/lib/research/keyword-intel/dataforseo-keywords";
import {
  enforceKeywordSourcePolicy,
  normalizeKeywordSourceConfig,
  type KeywordSourceConfig,
} from "@/lib/research/keyword-intel/keyword-source-config-types";

export type {
  KeywordSourceConfig,
  KeywordSourceEnabled,
} from "@/lib/research/keyword-intel/keyword-source-config-types";

export {
  DEFAULT_CATEGORY_PRESETS,
  enforceKeywordSourcePolicy,
  KEYWORD_INTEL_ACTIVE_SOURCES,
  summarizeEnabledKeywordSources,
  normalizeKeywordSourceConfig,
} from "@/lib/research/keyword-intel/keyword-source-config-types";

export const keywordSourceConfigSchema = z
  .object({
    enabled: z.object({
      googleTrends: z.boolean(),
      marketplaceAutocomplete: z.boolean(),
      dataforseo: z.boolean(),
      shopeeSearch: z.boolean(),
      competitor: z.boolean(),
      reviewIntel: z.boolean(),
      socialListening: z.boolean(),
    }),
  })
  .superRefine((cfg, ctx) => {
    const anyEnabled = Object.values(cfg.enabled).some(Boolean);
    if (!anyEnabled) {
      ctx.addIssue({
        code: "custom",
        message: "Minimal satu sumber harus diaktifkan.",
      });
    }
  });

export function getDefaultKeywordSourceConfig(): KeywordSourceConfig {
  return enforceKeywordSourcePolicy({
    enabled: {
      googleTrends: true,
      marketplaceAutocomplete: true,
      dataforseo: isDataForSeoConfigured(),
      socialListening: false,
      shopeeSearch: false,
      competitor: false,
      reviewIntel: false,
    },
  });
}

export function parseKeywordSourceConfigJson(
  raw: unknown,
): KeywordSourceConfig | null {
  if (!raw || typeof raw !== "object") return null;
  try {
    return keywordSourceConfigSchema.parse(raw);
  } catch {
    return null;
  }
}

export function validateKeywordSourceConfig(raw: unknown): KeywordSourceConfig {
  const parsed = keywordSourceConfigSchema.parse(raw);
  return enforceKeywordSourcePolicy(
    normalizeKeywordSourceConfig(parsed, getDefaultKeywordSourceConfig()),
  );
}

export function resolveKeywordSourceConfig(
  stored: KeywordSourceConfig | null,
): KeywordSourceConfig {
  return enforceKeywordSourcePolicy(
    normalizeKeywordSourceConfig(stored, getDefaultKeywordSourceConfig()),
  );
}
