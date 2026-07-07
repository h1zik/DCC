import { z } from "zod";
import {
  CUSTOM_THEME_VAR_KEYS,
  DEFAULT_CUSTOM_THEME,
  generateThemeVars,
  isConfigDark,
  type CustomThemeConfig,
} from "@/lib/theme-generator";

export const APP_THEME_PRESETS = {
  original: {
    label: "Original",
    swatches: ["#2d2d2d", "#66c0f4", "#f5a623"],
    isDark: true,
  },
  light: {
    label: "Light",
    swatches: ["#f5f5f0", "#3d3d3d", "#c9a87c"],
    isDark: false,
  },
  midnight: {
    label: "Midnight",
    swatches: ["#1a1a2e", "#a0a0b0", "#e63946"],
    isDark: true,
  },
  paper: {
    label: "Paper",
    swatches: ["#faf8f5", "#2c2c2c", "#c9a227"],
    isDark: false,
  },
  cyberpunk: {
    label: "Cyberpunk",
    swatches: ["#0a0a0f", "#00f0ff", "#ff00aa"],
    isDark: true,
  },
  retrowave: {
    label: "Retrowave",
    swatches: ["#1a0a2e", "#ff006e", "#fb5607"],
    isDark: true,
  },
  forest: {
    label: "Forest",
    swatches: ["#0d2818", "#2d6a4f", "#95d5b2"],
    isDark: true,
  },
  ocean: {
    label: "Ocean",
    swatches: ["#0a1628", "#48cae4", "#0077b6"],
    isDark: true,
  },
  ume: {
    label: "Ume",
    swatches: ["#2d1b33", "#f8bbd9", "#e91e8c"],
    isDark: true,
  },
  copper: {
    label: "Copper",
    swatches: ["#0d0d0d", "#d4a574", "#b87333"],
    isDark: true,
  },
  terminal: {
    label: "Terminal",
    swatches: ["#0a0a0a", "#1a3a1a", "#39ff14"],
    isDark: true,
  },
  organs: {
    label: "Organs",
    swatches: ["#0d0d0d", "#f5e6d3", "#8b0000"],
    isDark: true,
  },
  lavender: {
    label: "Lavender",
    swatches: ["#faf5ff", "#5b21b6", "#c4b5fd"],
    isDark: false,
  },
  gpt: {
    label: "GPT",
    swatches: ["#212121", "#ececec", "#8e8e8e"],
    isDark: true,
  },
  claude: {
    label: "Claude",
    swatches: ["#1a1a1a", "#f0ebe3", "#c4a882"],
    isDark: true,
  },
  cute: {
    label: "Cute",
    swatches: ["#fff5f8", "#ffc0cb", "#ff1493"],
    isDark: false,
  },
} as const;

/** Preset bawaan, atau `"custom"` (token dihitung dari `appThemeCustom`). */
export type AppThemePreset = keyof typeof APP_THEME_PRESETS | "custom";

/** Hanya preset bawaan (untuk galeri swatch); `"custom"` ditangani terpisah. */
export const APP_THEME_PRESET_IDS = Object.keys(
  APP_THEME_PRESETS,
) as Exclude<AppThemePreset, "custom">[];

export const DEFAULT_APP_THEME_PRESET: AppThemePreset = "original";

export function isAppThemePreset(v: string): v is AppThemePreset {
  return v === "custom" || v in APP_THEME_PRESETS;
}

export function resolveAppThemePreset(
  v: string | null | undefined,
): AppThemePreset {
  if (v && isAppThemePreset(v)) return v;
  return DEFAULT_APP_THEME_PRESET;
}

export function themeUsesCustomTokens(preset: AppThemePreset): boolean {
  return preset !== "original";
}

function resolveNextThemesDark(): boolean {
  if (typeof window === "undefined") return false;
  const stored = localStorage.getItem("theme");
  if (stored === "dark") return true;
  if (stored === "light") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function applyAppThemeToDocument(
  preset: AppThemePreset,
  custom?: CustomThemeConfig | null,
): void {
  if (typeof document === "undefined") return;

  const el = document.documentElement;

  if (preset === "custom") {
    const cfg = custom ?? DEFAULT_CUSTOM_THEME;
    const vars = generateThemeVars(cfg);
    el.setAttribute("data-theme", "custom");
    if (isConfigDark(cfg)) el.classList.add("dark");
    else el.classList.remove("dark");
    for (const [key, value] of Object.entries(vars)) {
      el.style.setProperty(key, value);
    }
    return;
  }

  // Bersihkan token inline sisa tema custom sebelumnya (bila ada).
  for (const key of CUSTOM_THEME_VAR_KEYS) el.style.removeProperty(key);

  if (preset === "original") {
    el.removeAttribute("data-theme");
    if (resolveNextThemesDark()) el.classList.add("dark");
    else el.classList.remove("dark");
    return;
  }

  el.setAttribute("data-theme", preset);
  if (APP_THEME_PRESETS[preset].isDark) {
    el.classList.add("dark");
  } else {
    el.classList.remove("dark");
  }
}

export function resolveSonnerTheme(
  preset: AppThemePreset,
  custom?: CustomThemeConfig | null,
): "light" | "dark" {
  if (preset === "custom") {
    return custom && isConfigDark(custom) ? "dark" : "light";
  }
  if (preset === "original") {
    if (typeof document !== "undefined") {
      return document.documentElement.classList.contains("dark")
        ? "dark"
        : "light";
    }
    return "light";
  }
  return APP_THEME_PRESETS[preset].isDark ? "dark" : "light";
}

export const appThemeSchema = z
  .string()
  .refine(isAppThemePreset, "Tema aplikasi tidak dikenal");
