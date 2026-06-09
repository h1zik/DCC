"use client";

import { SessionProvider } from "next-auth/react";
import type { Session } from "next-auth";
import { ThemeProvider } from "next-themes";
import { AppThemeProvider } from "@/components/app-theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import type { AppThemePreset } from "@/lib/app-themes";

export function Providers({
  session,
  initialAppTheme,
  children,
}: {
  session: Session | null;
  initialAppTheme: AppThemePreset;
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
        <AppThemeProvider initialPreset={initialAppTheme}>
          <TooltipProvider>
            {children}
            <Toaster richColors position="top-center" />
          </TooltipProvider>
        </AppThemeProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
