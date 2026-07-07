import type { AppThemePreset } from "@/lib/app-themes";

export type ThemePaletteHues = {
  /** Latar netral — slate, zinc, neutral, gray */
  base: number;
  /** Info / link — sky, blue, cyan */
  primary: number;
  /** Aksen kuat — violet, purple, fuchsia */
  accent: number;
  /** Aksen sekunder — pink */
  secondary: number;
  /** Sukses — emerald, green */
  success: number;
  /** Peringatan — amber, orange */
  warning: number;
  /** Bahaya — red, rose */
  danger: number;
};

export const THEME_PALETTE_HUES: Record<
  Exclude<AppThemePreset, "original" | "custom">,
  ThemePaletteHues
> = {
  light: {
    base: 80,
    primary: 240,
    accent: 300,
    secondary: 350,
    success: 155,
    warning: 55,
    danger: 25,
  },
  midnight: {
    base: 280,
    primary: 280,
    accent: 25,
    secondary: 350,
    success: 155,
    warning: 55,
    danger: 25,
  },
  paper: {
    base: 70,
    primary: 220,
    accent: 85,
    secondary: 55,
    success: 145,
    warning: 65,
    danger: 25,
  },
  cyberpunk: {
    base: 280,
    primary: 195,
    accent: 330,
    secondary: 310,
    success: 165,
    warning: 45,
    danger: 15,
  },
  retrowave: {
    base: 300,
    primary: 250,
    accent: 10,
    secondary: 30,
    success: 155,
    warning: 40,
    danger: 5,
  },
  forest: {
    base: 155,
    primary: 200,
    accent: 130,
    secondary: 100,
    success: 145,
    warning: 65,
    danger: 25,
  },
  ocean: {
    base: 240,
    primary: 220,
    accent: 250,
    secondary: 200,
    success: 165,
    warning: 55,
    danger: 25,
  },
  ume: {
    base: 320,
    primary: 340,
    accent: 350,
    secondary: 10,
    success: 155,
    warning: 55,
    danger: 20,
  },
  copper: {
    base: 55,
    primary: 55,
    accent: 45,
    secondary: 35,
    success: 145,
    warning: 50,
    danger: 25,
  },
  terminal: {
    base: 140,
    primary: 145,
    accent: 145,
    secondary: 130,
    success: 145,
    warning: 90,
    danger: 25,
  },
  organs: {
    base: 30,
    primary: 70,
    accent: 25,
    secondary: 55,
    success: 145,
    warning: 55,
    danger: 20,
  },
  lavender: {
    base: 300,
    primary: 280,
    accent: 300,
    secondary: 320,
    success: 155,
    warning: 55,
    danger: 25,
  },
  gpt: {
    base: 0,
    primary: 0,
    accent: 0,
    secondary: 0,
    success: 155,
    warning: 55,
    danger: 25,
  },
  claude: {
    base: 65,
    primary: 65,
    accent: 55,
    secondary: 45,
    success: 155,
    warning: 55,
    danger: 25,
  },
  cute: {
    base: 350,
    primary: 340,
    accent: 350,
    secondary: 10,
    success: 155,
    warning: 55,
    danger: 25,
  },
};

export const PALETTE_SHADES = [
  50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950,
] as const;

export const CHROMATIC_FAMILIES = {
  primary: ["sky", "blue", "cyan", "indigo"],
  accent: ["violet", "purple", "fuchsia"],
  secondary: ["pink"],
  success: ["emerald", "green", "teal", "lime"],
  warning: ["amber", "orange", "yellow"],
  danger: ["red", "rose"],
} as const;

export const NEUTRAL_FAMILIES = ["slate", "zinc", "neutral", "gray", "stone"] as const;
