"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateAppTheme } from "@/actions/app-theme";
import { actionErrorMessage } from "@/lib/action-error-message";
import {
  applyAppThemeToDocument,
  DEFAULT_APP_THEME_PRESET,
  resolveAppThemePreset,
  type AppThemePreset,
} from "@/lib/app-themes";

type AppThemeContextValue = {
  preset: AppThemePreset;
  savedPreset: AppThemePreset;
  setPreset: (preset: AppThemePreset) => void;
  commitPreset: (preset: AppThemePreset) => void;
  savePreset: () => void;
  resetPreview: () => void;
  isDirty: boolean;
  isSaving: boolean;
  isCustomTheme: boolean;
};

const AppThemeContext = createContext<AppThemeContextValue | null>(null);

export function AppThemeProvider({
  initialPreset,
  children,
}: {
  initialPreset: AppThemePreset;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const saved = resolveAppThemePreset(initialPreset);
  const [preset, setPresetState] = useState<AppThemePreset>(saved);
  const [savedPreset, setSavedPreset] = useState<AppThemePreset>(saved);
  const [isSaving, startSave] = useTransition();

  useEffect(() => {
    applyAppThemeToDocument(preset);
  }, [preset]);

  useEffect(() => {
    setPresetState(saved);
    setSavedPreset(saved);
  }, [saved]);

  const setPreset = useCallback((next: AppThemePreset) => {
    setPresetState(next);
  }, []);

  const commitPreset = useCallback((next: AppThemePreset) => {
    setPresetState(next);
    setSavedPreset(next);
    applyAppThemeToDocument(next);
  }, []);

  const resetPreview = useCallback(() => {
    setPresetState(savedPreset);
    applyAppThemeToDocument(savedPreset);
  }, [savedPreset]);

  const savePreset = useCallback(() => {
    startSave(async () => {
      try {
        await updateAppTheme(preset);
        setSavedPreset(preset);
        applyAppThemeToDocument(preset);
        router.refresh();
        toast.success("Tema aplikasi disimpan.");
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal menyimpan tema."));
        resetPreview();
      }
    });
  }, [preset, resetPreview, router]);

  const value = useMemo<AppThemeContextValue>(
    () => ({
      preset,
      savedPreset,
      setPreset,
      commitPreset,
      savePreset,
      resetPreview,
      isDirty: preset !== savedPreset,
      isSaving,
      isCustomTheme: savedPreset !== DEFAULT_APP_THEME_PRESET,
    }),
    [preset, savedPreset, setPreset, commitPreset, savePreset, resetPreview, isSaving],
  );

  return (
    <AppThemeContext.Provider value={value}>{children}</AppThemeContext.Provider>
  );
}

export function useAppTheme(): AppThemeContextValue {
  const ctx = useContext(AppThemeContext);
  if (!ctx) {
    throw new Error("useAppTheme must be used within AppThemeProvider");
  }
  return ctx;
}
