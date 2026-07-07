"use client";

import { SessionProvider } from "next-auth/react";
import type { Session } from "next-auth";
import { ThemeProvider } from "next-themes";
import { AppThemeProvider } from "@/components/app-theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import type { AppThemePreset } from "@/lib/app-themes";
import type { ThemeLibrary } from "@/lib/theme-generator";

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
  return (
    <SessionProvider session={session}>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
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
