"use client";

import { Label } from "@/components/ui/label";
import {
  KEYWORD_INTEL_ACTIVE_SOURCES,
  type KeywordSourceConfig,
  type KeywordSourceEnabled,
} from "@/lib/research/keyword-intel/keyword-source-config-types";

const SOURCE_LABELS: Record<
  (typeof KEYWORD_INTEL_ACTIVE_SOURCES)[number],
  string
> = {
  marketplaceAutocomplete: "Shopee Autocomplete",
  googleTrends: "Google Trends",
  dataforseo: "DataForSEO (volume & trend Google)",
};

export function KeywordSourceConfigPicker({
  config,
  onChange,
}: {
  config: KeywordSourceConfig;
  onChange: (config: KeywordSourceConfig) => void;
}) {
  function toggle(key: keyof KeywordSourceEnabled) {
    onChange({
      ...config,
      enabled: { ...config.enabled, [key]: !config.enabled[key] },
    });
  }

  return (
    <div className="grid gap-2">
      <Label className="text-xs font-medium">Sumber sinyal</Label>
      <div className="grid gap-1.5 sm:grid-cols-2">
        {KEYWORD_INTEL_ACTIVE_SOURCES.map((key) => (
          <label
            key={key}
            className="flex cursor-pointer items-center gap-2 rounded-md border px-2 py-1.5 text-xs"
          >
            <input
              type="checkbox"
              checked={config.enabled[key]}
              onChange={() => toggle(key)}
            />
            {SOURCE_LABELS[key]}
          </label>
        ))}
      </div>
    </div>
  );
}

export function validateKeywordConfigClient(
  config: KeywordSourceConfig,
): string | null {
  const anyActive = KEYWORD_INTEL_ACTIVE_SOURCES.some((k) => config.enabled[k]);
  return anyActive ? null : "Minimal satu sumber harus diaktifkan.";
}
