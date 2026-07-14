"use client";

import { useLayoutEffect, useRef } from "react";
import { useAppTheme } from "@/components/app-theme-provider";
import { applyAppThemeToDocument } from "@/lib/app-themes";
import {
  LAB_ACTIVE_ATTR,
  applyLabThemeToDocument,
  useLabMode,
} from "@/lib/lab-theme";

/**
 * Pengendali takeover tema Lab (headless).
 * - Mount / ganti mode: ambil alih tema global <html>.
 * - Unmount (keluar Lab): lepas penanda takeover lalu pulihkan tema DCC
 *   pengguna lewat jalur yang sama dengan ThemeMenu (`applyAppThemeToDocument`)
 *   — termasuk preset "original" (baca localStorage next-themes) dan "custom"
 *   (suntik ulang var inline).
 */
export function LabThemeController() {
  const mode = useLabMode();
  const { savedPreset, activeCustom } = useAppTheme();

  // Nilai restore terbaru untuk cleanup unmount, tanpa me-re-run efek unmount.
  const restoreRef = useRef({ savedPreset, activeCustom });
  useLayoutEffect(() => {
    restoreRef.current = { savedPreset, activeCustom };
  }, [savedPreset, activeCustom]);

  useLayoutEffect(() => {
    applyLabThemeToDocument(mode);
  }, [mode]);

  useLayoutEffect(() => {
    return () => {
      const el = document.documentElement;
      el.removeAttribute(LAB_ACTIVE_ATTR); // buka guard dulu
      el.removeAttribute("data-theme");
      const { savedPreset, activeCustom } = restoreRef.current;
      applyAppThemeToDocument(savedPreset, activeCustom);
    };
  }, []);

  return null;
}
