import { z } from "zod";

/**
 * Generator tema kustom + perpustakaan tema per-user.
 *
 * Dari beberapa input (warna latar, aksen, radius, font) menghasilkan seluruh
 * token CSS oklch aplikasi. Warna latar dipilih bebas; lightness-nya dipetakan
 * ke rentang yang selalu terbaca (auto-kontras), sementara hue/chroma latar
 * dihormati. Dipakai bersama di server (SSR anti-flicker) & client (live preview).
 *
 * Murni & deterministik — tak menyentuh `document`/`window`.
 */

export type ThemeRadius = "sharp" | "default" | "rounded" | "extra";
export type ThemeFontKey =
  | "geist"
  | "inter"
  | "poppins"
  | "nunito"
  | "plex"
  | "grotesk"
  | "merriweather"
  | "robotoslab";

export type CustomThemeConfig = {
  /** Warna aksen `#RRGGBB`. */
  accent: string;
  /** Warna latar `#RRGGBB` (bebas; kecerahan dijaga agar teks terbaca). */
  bg: string;
  radius: ThemeRadius;
  fontBody: ThemeFontKey;
  fontHeading: ThemeFontKey;
};

export const DEFAULT_CUSTOM_THEME: CustomThemeConfig = {
  accent: "#E07C3E",
  bg: "#FAFAF9",
  radius: "default",
  fontBody: "geist",
  fontHeading: "geist",
};

export const THEME_ACCENT_PRESETS = [
  "#E07C3E",
  "#E5397F",
  "#7C3AED",
  "#2563EB",
  "#0EA5A4",
  "#16A34A",
  "#F59E0B",
  "#DC2626",
] as const;

/** Preset latar: terang (kiri) & gelap (kanan), sudah di rentang legible. */
export const THEME_BG_PRESETS = {
  light: ["#FAFAF9", "#FBF7F0", "#F3F6FC", "#F1F8F3", "#F8F3FA"],
  dark: ["#15141A", "#141824", "#1B1420", "#12191A", "#131A16"],
} as const;

export const THEME_FONTS: {
  key: ThemeFontKey;
  label: string;
  varName: string;
  category: "sans" | "serif";
}[] = [
  { key: "geist", label: "Geist", varName: "--font-geist-sans", category: "sans" },
  { key: "inter", label: "Inter", varName: "--font-inter", category: "sans" },
  { key: "poppins", label: "Poppins", varName: "--font-poppins", category: "sans" },
  { key: "nunito", label: "Nunito", varName: "--font-nunito", category: "sans" },
  { key: "plex", label: "IBM Plex Sans", varName: "--font-plex-sans", category: "sans" },
  { key: "grotesk", label: "Space Grotesk", varName: "--font-space-grotesk", category: "sans" },
  { key: "merriweather", label: "Merriweather", varName: "--font-merriweather", category: "serif" },
  { key: "robotoslab", label: "Roboto Slab", varName: "--font-roboto-slab", category: "serif" },
];

const FONT_BY_KEY = new Map(THEME_FONTS.map((f) => [f.key, f]));

function fontStack(key: ThemeFontKey): string {
  const f = FONT_BY_KEY.get(key) ?? THEME_FONTS[0]!;
  const fallback =
    f.category === "serif"
      ? "ui-serif, Georgia, serif"
      : "ui-sans-serif, system-ui, sans-serif";
  return `var(${f.varName}), ${fallback}`;
}

const RADIUS_REM: Record<ThemeRadius, number> = {
  sharp: 0.25,
  default: 0.625,
  rounded: 1.0,
  extra: 1.5,
};

const HEX6 = /^#[0-9a-fA-F]{6}$/;

/** Konversi hex sRGB → OKLCH (lightness, chroma, hue derajat). */
export function hexToOklch(hex: string): { L: number; C: number; H: number } {
  const safe = HEX6.test(hex) ? hex : "#808080";
  let r = parseInt(safe.slice(1, 3), 16) / 255;
  let g = parseInt(safe.slice(3, 5), 16) / 255;
  let b = parseInt(safe.slice(5, 7), 16) / 255;
  const lin = (c: number) =>
    c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  r = lin(r);
  g = lin(g);
  b = lin(b);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const C = Math.sqrt(A * A + B * B);
  let H = (Math.atan2(B, A) * 180) / Math.PI;
  if (H < 0) H += 360;
  return { L, C, H };
}

function ok(L: number, C: number, H: number): string {
  return `oklch(${Math.max(0, Math.min(1, L)).toFixed(3)} ${Math.max(0, C).toFixed(3)} ${H.toFixed(1)})`;
}

/** Luminans relatif sRGB untuk memilih teks hitam/putih berkontras tertinggi. */
function relativeLuminance(hex: string): number {
  const safe = HEX6.test(hex) ? hex : "#808080";
  const channels = [1, 3, 5].map((start) => {
    const channel = parseInt(safe.slice(start, start + 2), 16) / 255;
    return channel <= 0.04045
      ? channel / 12.92
      : Math.pow((channel + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
}

/** Apakah tema tergolong gelap (dari kecerahan latar yang dipilih). */
export function isConfigDark(config: CustomThemeConfig): boolean {
  return hexToOklch(config.bg).L < 0.5;
}

export const CUSTOM_THEME_VAR_KEYS = [
  "--background",
  "--foreground",
  "--card",
  "--card-foreground",
  "--popover",
  "--popover-foreground",
  "--primary",
  "--primary-foreground",
  "--secondary",
  "--secondary-foreground",
  "--muted",
  "--muted-foreground",
  "--accent",
  "--accent-foreground",
  "--destructive",
  "--border",
  "--input",
  "--ring",
  "--chart-1",
  "--chart-2",
  "--chart-3",
  "--chart-4",
  "--chart-5",
  "--sidebar",
  "--sidebar-foreground",
  "--sidebar-primary",
  "--sidebar-primary-foreground",
  "--sidebar-accent",
  "--sidebar-accent-foreground",
  "--sidebar-border",
  "--sidebar-ring",
  "--radius",
  "--font-sans",
  "--font-heading",
  "--page-max-width",
  "--page-padding",
] as const;

export function generateThemeVars(
  config: CustomThemeConfig,
): Record<string, string> {
  const acc = hexToOklch(config.accent);
  // Hue tidak bermakna untuk warna netral. Menormalkannya mencegah noise
  // floating-point pada putih/abu/hitam berubah menjadi tint kuning atau warna
  // lain ketika token turunannya dibuat.
  const aH = acc.C < 0.0005 ? 0 : acc.H;
  const aC = Math.min(0.19, acc.C);

  // Latar: hormati hue & chroma, tapi petakan lightness ke rentang legible.
  const bgSrc = hexToOklch(config.bg);
  const bH = bgSrc.H;
  const dark = bgSrc.L < 0.5;
  const bC = Math.min(bgSrc.C, dark ? 0.04 : 0.05);
  // Kecerahan relatif dalam rentang aman: gelap [0.13..0.24], terang [0.90..0.98].
  const bgL = dark
    ? 0.13 + Math.min(bgSrc.L / 0.5, 1) * 0.11
    : 0.9 + Math.min((bgSrc.L - 0.5) / 0.5, 1) * 0.08;

  // Token utama harus merepresentasikan warna yang benar-benar dipilih user,
  // termasuk lightness dan saturasinya. Sebelumnya lightness diganti nilai tetap
  // dan chroma dipaksa minimal 0.09, sehingga #FFFFFF menjadi kuning/cokelat.
  const primary = ok(acc.L, acc.C, aH);
  // 0.179 adalah titik saat hitam mulai memberi rasio kontras lebih tinggi
  // daripada putih menurut rumus kontras WCAG.
  const primaryFg =
    relativeLuminance(config.accent) > 0.179
      ? ok(0.18, 0, 0)
      : ok(0.99, 0, 0);
  const ring = primary;
  const chartRamp = dark
    ? [0.78, 0.7, 0.62, 0.54, 0.46]
    : [0.72, 0.63, 0.55, 0.47, 0.4];

  const vars: Record<string, string> = {};

  // Aksen / brand.
  vars["--primary"] = primary;
  vars["--primary-foreground"] = primaryFg;
  vars["--ring"] = ring;
  vars["--sidebar-primary"] = vars["--primary"];
  vars["--sidebar-primary-foreground"] = primaryFg;
  vars["--sidebar-ring"] = ring;
  vars["--destructive"] = dark ? "oklch(0.70 0.19 22)" : "oklch(0.58 0.22 27)";
  chartRamp.forEach((L, i) => {
    vars[`--chart-${i + 1}`] = ok(L, aC, aH);
  });

  // Netral / permukaan — diturunkan dari latar.
  vars["--background"] = ok(bgL, bC, bH);
  vars["--accent"] = dark ? ok(0.32, aC * 0.5, aH) : ok(0.93, aC * 0.5, aH);
  vars["--accent-foreground"] = dark
    ? ok(0.95, aC * 0.4, aH)
    : ok(0.32, aC, aH);

  if (!dark) {
    vars["--foreground"] = ok(0.22, Math.min(bC, 0.02), bH);
    vars["--card"] = ok(Math.min(bgL + 0.03, 0.998), bC * 0.4, bH);
    vars["--card-foreground"] = vars["--foreground"];
    vars["--popover"] = vars["--card"];
    vars["--popover-foreground"] = vars["--foreground"];
    vars["--secondary"] = ok(bgL - 0.03, bC, bH);
    vars["--secondary-foreground"] = vars["--foreground"];
    vars["--muted"] = ok(bgL - 0.03, bC, bH);
    vars["--muted-foreground"] = ok(0.5, bC * 1.5, bH);
    vars["--border"] = ok(bgL - 0.07, bC, bH);
    vars["--input"] = ok(bgL - 0.07, bC, bH);
    vars["--sidebar"] = ok(Math.min(bgL + 0.015, 0.99), bC, bH);
    vars["--sidebar-foreground"] = ok(0.28, bC, bH);
    vars["--sidebar-accent"] = ok(0.93, aC * 0.55, aH);
    vars["--sidebar-accent-foreground"] = ok(0.3, aC, aH);
    vars["--sidebar-border"] = ok(bgL - 0.07, bC, bH);
  } else {
    vars["--foreground"] = ok(0.96, Math.min(bC, 0.02), bH);
    vars["--card"] = ok(bgL + 0.045, bC, bH);
    vars["--card-foreground"] = vars["--foreground"];
    vars["--popover"] = vars["--card"];
    vars["--popover-foreground"] = vars["--foreground"];
    vars["--secondary"] = ok(bgL + 0.085, bC, bH);
    vars["--secondary-foreground"] = vars["--foreground"];
    vars["--muted"] = ok(bgL + 0.085, bC, bH);
    vars["--muted-foreground"] = ok(0.7, bC, bH);
    vars["--border"] = "oklch(1 0 0 / 0.12)";
    vars["--input"] = "oklch(1 0 0 / 0.15)";
    vars["--sidebar"] = ok(bgL + 0.02, bC * 1.1, bH);
    vars["--sidebar-foreground"] = ok(0.94, bC, bH);
    vars["--sidebar-accent"] = ok(0.3, aC * 0.5, aH);
    vars["--sidebar-accent-foreground"] = ok(0.95, aC * 0.4, aH);
    vars["--sidebar-border"] = "oklch(1 0 0 / 0.12)";
  }

  vars["--radius"] = `${RADIUS_REM[config.radius]}rem`;
  vars["--font-sans"] = fontStack(config.fontBody);
  vars["--font-heading"] = fontStack(config.fontHeading);
  vars["--page-max-width"] = "87.5rem";
  vars["--page-padding"] = "1.5rem";

  return vars;
}

/* ------------------------- Skema & perpustakaan tema ------------------------ */

const fontKeyEnum = z.enum([
  "geist",
  "inter",
  "poppins",
  "nunito",
  "plex",
  "grotesk",
  "merriweather",
  "robotoslab",
]);

export const customThemeConfigSchema = z.object({
  accent: z.string().regex(HEX6, "Warna aksen harus hex #RRGGBB"),
  bg: z.string().regex(HEX6, "Warna latar harus hex #RRGGBB"),
  radius: z.enum(["sharp", "default", "rounded", "extra"]),
  fontBody: fontKeyEnum,
  fontHeading: fontKeyEnum,
});

export type SavedTheme = {
  id: string;
  name: string;
  config: CustomThemeConfig;
};

/** Perpustakaan tema kustom per-user + tema mana yang aktif. */
export type ThemeLibrary = {
  themes: SavedTheme[];
  activeId: string | null;
};

export const DEFAULT_THEME_LIBRARY: ThemeLibrary = {
  themes: [],
  activeId: null,
};

const savedThemeSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(40),
  config: customThemeConfigSchema,
});

export const themeLibrarySchema = z.object({
  themes: z.array(savedThemeSchema).max(24),
  activeId: z.string().nullable(),
});

/** Normalisasi nilai Json apa pun jadi ThemeLibrary valid. */
export function resolveThemeLibrary(value: unknown): ThemeLibrary {
  const parsed = themeLibrarySchema.safeParse(value);
  return parsed.success ? parsed.data : DEFAULT_THEME_LIBRARY;
}

/** Config tema kustom yang sedang aktif (atau default bila belum ada). */
export function activeCustomConfig(lib: ThemeLibrary): CustomThemeConfig {
  const active = lib.themes.find((t) => t.id === lib.activeId);
  return active?.config ?? lib.themes[0]?.config ?? DEFAULT_CUSTOM_THEME;
}

function genThemeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `t-${Date.now().toString(36)}`;
}

export function newSavedTheme(
  name: string,
  config: CustomThemeConfig,
): SavedTheme {
  return { id: genThemeId(), name, config };
}
