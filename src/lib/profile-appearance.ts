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

/* -------------------------------------------------------------------------- */
/*                              Banner patterns                                */
/* -------------------------------------------------------------------------- */

const NOISE_SVG_DATA_URL =
  `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

export const PROFILE_BANNER_PATTERNS = {
  none: { label: "Polos", emoji: "○" },
  noise: { label: "Noise", emoji: "▒" },
  dots: { label: "Dots", emoji: "•" },
  grid: { label: "Grid", emoji: "▦" },
  rays: { label: "Rays", emoji: "✦" },
  waves: { label: "Waves", emoji: "～" },
  confetti: { label: "Confetti", emoji: "✶" },
  bokeh: { label: "Bokeh", emoji: "❍" },
  diamond: { label: "Diamond", emoji: "◆" },
} as const;

export type ProfileBannerPattern = keyof typeof PROFILE_BANNER_PATTERNS;

export const PROFILE_BANNER_PATTERN_IDS = Object.keys(
  PROFILE_BANNER_PATTERNS,
) as ProfileBannerPattern[];

export function isProfileBannerPattern(v: string): v is ProfileBannerPattern {
  return v in PROFILE_BANNER_PATTERNS;
}

/**
 * CSS background style snippet untuk pola banner. Dipakai sebagai overlay di atas
 * gradien preset. Semua pola berbasis CSS / inline-SVG, jadi tidak butuh aset.
 */
export function bannerPatternStyle(
  pattern: ProfileBannerPattern,
): { backgroundImage: string; backgroundSize?: string; opacity?: number } {
  switch (pattern) {
    case "none":
      return { backgroundImage: "none", opacity: 0 };
    case "noise":
      return {
        backgroundImage: NOISE_SVG_DATA_URL,
        backgroundSize: "180px 180px",
        opacity: 0.18,
      };
    case "dots":
      return {
        backgroundImage:
          "radial-gradient(rgba(255,255,255,0.55) 1px, transparent 1.4px)",
        backgroundSize: "14px 14px",
        opacity: 0.35,
      };
    case "grid":
      return {
        backgroundImage:
          "linear-gradient(rgba(255,255,255,0.18) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.18) 1px, transparent 1px)",
        backgroundSize: "28px 28px",
        opacity: 0.55,
      };
    case "rays":
      return {
        backgroundImage:
          "repeating-conic-gradient(from 0deg at 50% 100%, rgba(255,255,255,0.22) 0deg 6deg, transparent 6deg 14deg)",
        opacity: 0.4,
      };
    case "waves":
      return {
        backgroundImage:
          "repeating-radial-gradient(circle at 50% 120%, rgba(255,255,255,0.22) 0 2px, transparent 2px 18px)",
        opacity: 0.45,
      };
    case "confetti":
      return {
        backgroundImage:
          "radial-gradient(circle at 12% 18%, rgba(255,255,255,0.65) 1.2px, transparent 2px), radial-gradient(circle at 72% 32%, rgba(255,255,255,0.4) 1.6px, transparent 2.4px), radial-gradient(circle at 38% 72%, rgba(255,255,255,0.55) 1.4px, transparent 2.2px), radial-gradient(circle at 88% 82%, rgba(255,255,255,0.35) 1.6px, transparent 2.6px)",
        backgroundSize: "180px 180px, 220px 220px, 240px 240px, 260px 260px",
        opacity: 0.85,
      };
    case "bokeh":
      return {
        backgroundImage:
          "radial-gradient(circle at 18% 28%, rgba(255,255,255,0.4) 0 12px, transparent 24px), radial-gradient(circle at 78% 18%, rgba(255,255,255,0.32) 0 18px, transparent 30px), radial-gradient(circle at 32% 80%, rgba(255,255,255,0.28) 0 22px, transparent 38px), radial-gradient(circle at 86% 78%, rgba(255,255,255,0.24) 0 14px, transparent 28px)",
        opacity: 0.9,
      };
    case "diamond":
      return {
        backgroundImage:
          "linear-gradient(45deg, rgba(255,255,255,0.18) 25%, transparent 25%), linear-gradient(-45deg, rgba(255,255,255,0.18) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, rgba(255,255,255,0.18) 75%), linear-gradient(-45deg, transparent 75%, rgba(255,255,255,0.18) 75%)",
        backgroundSize: "22px 22px",
        opacity: 0.45,
      };
    default:
      return { backgroundImage: NOISE_SVG_DATA_URL, backgroundSize: "180px 180px", opacity: 0.18 };
  }
}

/* -------------------------------------------------------------------------- */
/*                               Stickers                                      */
/* -------------------------------------------------------------------------- */

export const PROFILE_STICKERS = {
  crown: { label: "Mahkota", emoji: "👑" },
  star: { label: "Bintang", emoji: "⭐" },
  sparkle: { label: "Sparkle", emoji: "✨" },
  flame: { label: "Api", emoji: "🔥" },
  trophy: { label: "Piala", emoji: "🏆" },
  rocket: { label: "Roket", emoji: "🚀" },
  heart: { label: "Hati", emoji: "💛" },
  leaf: { label: "Daun", emoji: "🌿" },
  moon: { label: "Bulan", emoji: "🌙" },
  bolt: { label: "Petir", emoji: "⚡" },
  diamond: { label: "Permata", emoji: "💎" },
  coffee: { label: "Kopi", emoji: "☕" },
} as const;

export type ProfileSticker = keyof typeof PROFILE_STICKERS;

export const PROFILE_STICKER_IDS = Object.keys(
  PROFILE_STICKERS,
) as ProfileSticker[];

export function isProfileSticker(v: string): v is ProfileSticker {
  return v in PROFILE_STICKERS;
}

export function normalizeProfileSticker(
  raw: string | null | undefined,
): ProfileSticker | null {
  const t = (raw ?? "").trim();
  if (!t) return null;
  return isProfileSticker(t) ? t : null;
}

/* -------------------------------------------------------------------------- */
/*                              Avatar frames                                  */
/* -------------------------------------------------------------------------- */

export const PROFILE_AVATAR_FRAMES = {
  ring: { label: "Ring" },
  glow: { label: "Glow" },
  gem: { label: "Gem" },
  dashed: { label: "Dashed" },
  none: { label: "Tanpa" },
} as const;

export type ProfileAvatarFrame = keyof typeof PROFILE_AVATAR_FRAMES;

export const PROFILE_AVATAR_FRAME_IDS = Object.keys(
  PROFILE_AVATAR_FRAMES,
) as ProfileAvatarFrame[];

export function isProfileAvatarFrame(v: string): v is ProfileAvatarFrame {
  return v in PROFILE_AVATAR_FRAMES;
}

/* -------------------------------------------------------------------------- */
/*                                  Schema                                    */
/* -------------------------------------------------------------------------- */

export const profileAppearanceSchema = z.object({
  profileBannerPreset: z
    .string()
    .trim()
    .refine(isProfileBannerPreset, "Tema banner tidak dikenal"),
  profileTagline: z.string().max(160, "Maksimal 160 karakter").optional(),
  profileAccentHex: z.string().trim().max(7).optional(),
  profileBannerPattern: z
    .string()
    .trim()
    .refine(isProfileBannerPattern, "Pola banner tidak dikenal")
    .default("noise"),
  profileSticker: z.string().trim().max(24).optional().nullable(),
  profileAvatarFrame: z
    .string()
    .trim()
    .refine(isProfileAvatarFrame, "Frame avatar tidak dikenal")
    .default("ring"),
});

export type ProfileAppearanceInput = z.infer<typeof profileAppearanceSchema>;

/** Normalisasi aksen: kosong / invalid → null (pakai default tema). */
export function normalizeProfileAccentHex(raw: string | null | undefined): string | null {
  const t = (raw ?? "").trim();
  if (t === "") return null;
  if (/^#[0-9A-Fa-f]{6}$/.test(t)) return t;
  return null;
}
