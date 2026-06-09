import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { auth } from "@/lib/auth";
import { getAppBranding } from "@/lib/app-branding";
import {
  APP_THEME_PRESETS,
  resolveAppThemePreset,
  themeUsesCustomTokens,
  type AppThemePreset,
} from "@/lib/app-themes";
import { prisma } from "@/lib/prisma";
import { Providers } from "@/components/providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

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
): Promise<AppThemePreset> {
  if (!userId) return "original";
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { appThemePreset: true },
  });
  return resolveAppThemePreset(user?.appThemePreset);
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  const initialAppTheme = await resolveInitialAppTheme(session?.user?.id);
  const usesCustom = themeUsesCustomTokens(initialAppTheme);
  const themeMeta = APP_THEME_PRESETS[initialAppTheme];

  return (
    <html
      lang="id"
      data-theme={usesCustom ? initialAppTheme : undefined}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased${usesCustom && themeMeta.isDark ? " dark" : ""}`}
      suppressHydrationWarning
    >
      <body className="bg-background text-foreground min-h-full">
        <Providers session={session} initialAppTheme={initialAppTheme}>
          {children}
        </Providers>
      </body>
    </html>
  );
}
