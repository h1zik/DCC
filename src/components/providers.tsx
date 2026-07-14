"use client";

import { usePathname } from "next/navigation";
import { SessionProvider } from "next-auth/react";
import type { Session } from "next-auth";
import { ThemeProvider } from "next-themes";
import { AppThemeProvider } from "@/components/app-theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { APP_THEME_PRESETS, type AppThemePreset } from "@/lib/app-themes";
import { useLabMode } from "@/lib/lab-theme";
import { isLabPathname } from "@/lib/routes";
import {
  activeCustomConfig,
  isConfigDark,
  type ThemeLibrary,
} from "@/lib/theme-generator";

export function Providers({
  session,
  initialAppTheme,
  initialLibrary,
  children,
}: {
  session: Session | null;
  initialAppTheme: AppThemePreset;
  initialLibrary: ThemeLibrary;
  children: React.ReactNode;
}) {
  // Mode terang/gelap dipaksa deterministik agar next-themes tidak pernah
  // bertengkar dengan `.dark` yang di-set tema aplikasi:
  // - Di dalam Dominatus Lab: ikuti mode Lab (localStorage terpisah).
  // - Preset DCC non-"original": ikuti `isDark` preset (custom: dari confignya).
  // - Preset "original": biarkan next-themes (pilihan terang/gelap pengguna).
  const pathname = usePathname();
  const labMode = useLabMode();
  const inLab = isLabPathname(pathname);
  let dccForced: "light" | "dark" | undefined;
  if (initialAppTheme === "custom") {
    dccForced = isConfigDark(activeCustomConfig(initialLibrary))
      ? "dark"
      : "light";
  } else if (initialAppTheme !== "original") {
    dccForced = APP_THEME_PRESETS[initialAppTheme].isDark ? "dark" : "light";
  }
  const forcedTheme = inLab ? labMode : dccForced;
  return (
    <SessionProvider session={session}>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
        forcedTheme={forcedTheme}
      >
        <AppThemeProvider
          initialPreset={initialAppTheme}
          initialLibrary={initialLibrary}
        >
          <TooltipProvider>
            {children}
            <Toaster richColors position="top-center" />
          </TooltipProvider>
        </AppThemeProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
