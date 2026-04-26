import { z } from "zod";

export const PROFILE_BANNER_PRESETS = {
  twilight: {
    label: "Twilight",
    from: "#1e1b4b",
    via: "#4338ca",
    to: "#0f172a",
    defaultAccent: "#a5b4fc",
  },
  ember: {
    label: "Ember",
    from: "#431407",
    via: "#c2410c",
    to: "#18181b",
    defaultAccent: "#fb923c",
  },
  ocean: {
    label: "Ocean",
    from: "#0c4a6e",
    via: "#0284c7",
    to: "#020617",
    defaultAccent: "#38bdf8",
  },
  forest: {
    label: "Forest",
    from: "#14532d",
    via: "#15803d",
    to: "#0f172a",
    defaultAccent: "#4ade80",
  },
  rose: {
    label: "Rose",
    from: "#4c0519",
    via: "#be123c",
    to: "#1c1917",
    defaultAccent: "#fb7185",
  },
  aurora: {
    label: "Aurora",
    from: "#134e4a",
    via: "#6d28d9",
    to: "#0f172a",
    defaultAccent: "#c4b5fd",
  },
  sunset: {
    label: "Sunset",
    from: "#7c2d12",
    via: "#ea580c",
    to: "#1e1b4b",
    defaultAccent: "#fdba74",
  },
  monochrome: {
    label: "Noir",
    from: "#18181b",
    via: "#52525b",
    to: "#09090b",
    defaultAccent: "#d4d4d8",
  },
} as const;

export type ProfileBannerPreset = keyof typeof PROFILE_BANNER_PRESETS;

export const PROFILE_BANNER_PRESET_IDS = Object.keys(
  PROFILE_BANNER_PRESETS,
) as ProfileBannerPreset[];

export function isProfileBannerPreset(v: string): v is ProfileBannerPreset {
  return v in PROFILE_BANNER_PRESETS;
}

export function resolveProfileAccent(
  preset: ProfileBannerPreset,
  accentHex: string | null | undefined,
): string {
  const hex = (accentHex ?? "").trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(hex)) return hex;
  return PROFILE_BANNER_PRESETS[preset].defaultAccent;
}

export function bannerGradientCss(preset: ProfileBannerPreset): string {
  const { from, via, to } = PROFILE_BANNER_PRESETS[preset];
  return `linear-gradient(135deg, ${from} 0%, ${via} 48%, ${to} 100%)`;
}

export const profileAppearanceSchema = z.object({
  profileBannerPreset: z
    .string()
    .trim()
    .refine(isProfileBannerPreset, "Tema banner tidak dikenal"),
  profileTagline: z.string().max(160, "Maksimal 160 karakter").optional(),
  profileAccentHex: z.string().trim().max(7).optional(),
});

export type ProfileAppearanceInput = z.infer<typeof profileAppearanceSchema>;

/** Normalisasi aksen: kosong / invalid → null (pakai default tema). */
export function normalizeProfileAccentHex(raw: string | null | undefined): string | null {
  const t = (raw ?? "").trim();
  if (t === "") return null;
  if (/^#[0-9A-Fa-f]{6}$/.test(t)) return t;
  return null;
}
