"use client";

import { useEffect, useState, useTransition } from "react";
import { Moon, Palette, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { updateAppTheme } from "@/actions/app-theme";
import { useAppTheme } from "@/components/app-theme-provider";
import { Button } from "@/components/ui/button";
import { actionErrorMessage } from "@/lib/action-error-message";
import { DEFAULT_APP_THEME_PRESET } from "@/lib/app-themes";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const { savedPreset, isCustomTheme, commitPreset } = useAppTheme();
  const [mounted, setMounted] = useState(false);
  const [pendingReset, startReset] = useTransition();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        disabled
        aria-label="Memuat tema"
      >
        <Sun />
      </Button>
    );
  }

  if (isCustomTheme) {
    return (
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        disabled={pendingReset}
        onClick={() => {
          startReset(async () => {
            try {
              await updateAppTheme(DEFAULT_APP_THEME_PRESET);
              commitPreset(DEFAULT_APP_THEME_PRESET);
              setTheme(resolvedTheme ?? "system");
              toast.success("Kembali ke tema Original.");
            } catch (err) {
              toast.error(
                actionErrorMessage(err, "Gagal mengubah tema."),
              );
            }
          });
        }}
        aria-label="Tema kustom aktif — klik untuk kembali ke Original"
        title={`Tema kustom (${savedPreset}) aktif — klik untuk Original`}
      >
        <Palette />
      </Button>
    );
  }

  const isDark = resolvedTheme === "dark";

  return (
    <Button
      type="button"
      variant="outline"
      size="icon-sm"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Ganti ke mode terang" : "Ganti ke mode gelap"}
      title={isDark ? "Mode terang" : "Mode gelap"}
    >
      {isDark ? <Sun /> : <Moon />}
    </Button>
  );
}
