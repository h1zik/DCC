import type { Metadata } from "next";
import {
  Geist,
  Geist_Mono,
  IBM_Plex_Sans,
  Inter,
  Merriweather,
  Nunito,
  Poppins,
  Roboto_Slab,
  Space_Grotesk,
} from "next/font/google";
import "./globals.css";
import { getSession } from "@/lib/get-session";
import { getAppBranding } from "@/lib/app-branding";
import { getUserAppTheme } from "@/lib/user-app-theme";
import {
  APP_THEME_PRESETS,
  resolveAppThemePreset,
  type AppThemePreset,
} from "@/lib/app-themes";
import {
  activeCustomConfig,
  DEFAULT_THEME_LIBRARY,
  generateThemeVars,
  isConfigDark,
  resolveThemeLibrary,
  type ThemeLibrary,
} from "@/lib/theme-generator";
import { Providers } from "@/components/providers";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

// Font kurasi untuk tema kustom. `preload: false` — file font hanya diunduh
// browser saat benar-benar dipakai (mis. user memilihnya), bukan di tiap halaman.
const fontInter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap", preload: false });
const fontPoppins = Poppins({ variable: "--font-poppins", subsets: ["latin"], weight: ["400", "500", "600", "700"], display: "swap", preload: false });
const fontNunito = Nunito({ variable: "--font-nunito", subsets: ["latin"], display: "swap", preload: false });
const fontPlex = IBM_Plex_Sans({ variable: "--font-plex-sans", subsets: ["latin"], weight: ["400", "500", "600", "700"], display: "swap", preload: false });
const fontGrotesk = Space_Grotesk({ variable: "--font-space-grotesk", subsets: ["latin"], display: "swap", preload: false });
const fontMerriweather = Merriweather({ variable: "--font-merriweather", subsets: ["latin"], weight: ["400", "700"], display: "swap", preload: false });
const fontRobotoSlab = Roboto_Slab({ variable: "--font-roboto-slab", subsets: ["latin"], display: "swap", preload: false });

const FONT_VARS = [
  geistSans.variable,
  geistMono.variable,
  fontInter.variable,
  fontPoppins.variable,
  fontNunito.variable,
  fontPlex.variable,
  fontGrotesk.variable,
  fontMerriweather.variable,
  fontRobotoSlab.variable,
].join(" ");

export async function generateMetadata(): Promise<Metadata> {
  const branding = await getAppBranding();
  return {
    title: branding.appName || "Dominatus Control Center",
    description:
      "ERP internal PT Dominatus Clean Solution — inventori, master data, dan dashboard eksekutif.",
    icons: branding.faviconPath
      ? {
          icon: branding.faviconPath,
          shortcut: branding.faviconPath,
          apple: branding.faviconPath,
        }
      : undefined,
  };
}

async function resolveInitialAppTheme(
  userId: string | undefined,
): Promise<{ preset: AppThemePreset; library: ThemeLibrary }> {
  if (!userId) return { preset: "original", library: DEFAULT_THEME_LIBRARY };
  const user = await getUserAppTheme(userId);
  return {
    preset: resolveAppThemePreset(user?.appThemePreset),
    library: resolveThemeLibrary(user?.appThemeCustom),
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getSession();
  const { preset, library } = await resolveInitialAppTheme(session?.user?.id);

  // Terapkan tema server-side (anti-flicker). Untuk `custom`, token oklch
  // di-generate dari tema aktif & disuntik sebagai style inline.
  let isDark = false;
  let dataTheme: string | undefined;
  let customVars: Record<string, string> | null = null;
  if (preset === "custom") {
    const active = activeCustomConfig(library);
    isDark = isConfigDark(active);
    dataTheme = "custom";
    customVars = generateThemeVars(active);
  } else if (preset !== "original") {
    isDark = APP_THEME_PRESETS[preset].isDark;
    dataTheme = preset;
  }

  return (
    <html
      lang="id"
      data-theme={dataTheme}
      className={`${FONT_VARS} h-full antialiased${isDark ? " dark" : ""}`}
      style={customVars ? (customVars as React.CSSProperties) : undefined}
      suppressHydrationWarning
    >
      <body className="bg-background text-foreground min-h-full">
        <Providers
          session={session}
          initialAppTheme={preset}
          initialLibrary={library}
        >
          {children}
        </Providers>
      </body>
    </html>
  );
}
