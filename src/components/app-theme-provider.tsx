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
import {
  activeCustomConfig,
  DEFAULT_CUSTOM_THEME,
  newSavedTheme,
  type CustomThemeConfig,
  type ThemeLibrary,
} from "@/lib/theme-generator";

type AppThemeContextValue = {
  preset: AppThemePreset;
  savedPreset: AppThemePreset;
  library: ThemeLibrary;
  savedLibrary: ThemeLibrary;
  /** Config tema kustom yang sedang aktif (derivasi dari library). */
  activeCustom: CustomThemeConfig;
  setPreset: (preset: AppThemePreset) => void;
  /** Set preset sekaligus tandai sebagai tersimpan (dipakai setelah persist). */
  commitPreset: (preset: AppThemePreset) => void;
  /** Seperti `commitPreset`, tapi bisa sekalian meng-commit library kustom. */
  commitSelection: (preset: AppThemePreset, lib?: ThemeLibrary) => void;
  /** Jadikan tema tersimpan sebagai aktif (dan pindah ke mode custom). */
  selectTheme: (id: string) => void;
  /** Buat tema baru (menyalin tema aktif bila ada) lalu aktifkan. */
  createTheme: () => void;
  updateActiveConfig: (patch: Partial<CustomThemeConfig>) => void;
  renameActiveTheme: (name: string) => void;
  deleteTheme: (id: string) => void;
  savePreset: () => void;
  resetPreview: () => void;
  isDirty: boolean;
  isSaving: boolean;
  isCustomTheme: boolean;
};

const AppThemeContext = createContext<AppThemeContextValue | null>(null);

export function AppThemeProvider({
  initialPreset,
  initialLibrary,
  children,
}: {
  initialPreset: AppThemePreset;
  initialLibrary: ThemeLibrary;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const saved = resolveAppThemePreset(initialPreset);
  const [preset, setPresetState] = useState<AppThemePreset>(saved);
  const [savedPreset, setSavedPreset] = useState<AppThemePreset>(saved);
  const [library, setLibraryState] = useState<ThemeLibrary>(initialLibrary);
  const [savedLibrary, setSavedLibrary] =
    useState<ThemeLibrary>(initialLibrary);
  const [isSaving, startSave] = useTransition();

  const activeCustom = useMemo(() => activeCustomConfig(library), [library]);

  // Terapkan pratinjau setiap preset atau tema aktif berubah.
  useEffect(() => {
    applyAppThemeToDocument(preset, activeCustom);
  }, [preset, activeCustom]);

  useEffect(() => {
    setPresetState(saved);
    setSavedPreset(saved);
  }, [saved]);

  // Sinkronkan pustaka tema saat prop dari server berubah tanpa provider
  // di-remount — mis. setelah login, root layout mengirim ulang initialLibrary
  // (tema kustom tersimpan) lewat navigasi klien. Tanpa ini, preset berubah ke
  // "custom" tapi library tetap kosong (default), sehingga tema tersimpan
  // tampak hilang sampai reload penuh. Key by-value agar hanya jalan saat isi
  // benar-benar berubah, bukan tiap render (referensi objek selalu baru).
  const initialLibraryKey = JSON.stringify(initialLibrary);
  useEffect(() => {
    setLibraryState(initialLibrary);
    setSavedLibrary(initialLibrary);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sinkron by-value via key
  }, [initialLibraryKey]);

  const setPreset = useCallback((next: AppThemePreset) => {
    setPresetState(next);
  }, []);

  const commitPreset = useCallback((next: AppThemePreset) => {
    setPresetState(next);
    setSavedPreset(next);
  }, []);

  const commitSelection = useCallback(
    (next: AppThemePreset, lib?: ThemeLibrary) => {
      setPresetState(next);
      setSavedPreset(next);
      if (lib) {
        setLibraryState(lib);
        setSavedLibrary(lib);
      }
    },
    [],
  );

  const selectTheme = useCallback((id: string) => {
    setLibraryState((lib) => ({ ...lib, activeId: id }));
    setPresetState("custom");
  }, []);

  const createTheme = useCallback(() => {
    setLibraryState((lib) => {
      const base = lib.themes.length
        ? activeCustomConfig(lib)
        : DEFAULT_CUSTOM_THEME;
      const theme = newSavedTheme(`Tema ${lib.themes.length + 1}`, base);
      return { themes: [...lib.themes, theme], activeId: theme.id };
    });
    setPresetState("custom");
  }, []);

  const updateActiveConfig = useCallback(
    (patch: Partial<CustomThemeConfig>) => {
      setLibraryState((lib) => {
        if (!lib.activeId) return lib;
        return {
          ...lib,
          themes: lib.themes.map((t) =>
            t.id === lib.activeId
              ? { ...t, config: { ...t.config, ...patch } }
              : t,
          ),
        };
      });
    },
    [],
  );

  const renameActiveTheme = useCallback((name: string) => {
    setLibraryState((lib) => {
      if (!lib.activeId) return lib;
      return {
        ...lib,
        themes: lib.themes.map((t) =>
          t.id === lib.activeId ? { ...t, name } : t,
        ),
      };
    });
  }, []);

  const deleteTheme = useCallback((id: string) => {
    setLibraryState((lib) => {
      const themes = lib.themes.filter((t) => t.id !== id);
      const activeId =
        lib.activeId === id ? (themes[0]?.id ?? null) : lib.activeId;
      return { themes, activeId };
    });
  }, []);

  const resetPreview = useCallback(() => {
    setPresetState(savedPreset);
    setLibraryState(savedLibrary);
  }, [savedPreset, savedLibrary]);

  const savePreset = useCallback(() => {
    startSave(async () => {
      try {
        await updateAppTheme(preset, library);
        setSavedPreset(preset);
        setSavedLibrary(library);
        router.refresh();
        toast.success("Tema aplikasi disimpan.");
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal menyimpan tema."));
        resetPreview();
      }
    });
  }, [preset, library, resetPreview, router]);

  const isDirty =
    preset !== savedPreset ||
    JSON.stringify(library) !== JSON.stringify(savedLibrary);

  const value = useMemo<AppThemeContextValue>(
    () => ({
      preset,
      savedPreset,
      library,
      savedLibrary,
      activeCustom,
      setPreset,
      commitPreset,
      commitSelection,
      selectTheme,
      createTheme,
      updateActiveConfig,
      renameActiveTheme,
      deleteTheme,
      savePreset,
      resetPreview,
      isDirty,
      isSaving,
      isCustomTheme: savedPreset !== DEFAULT_APP_THEME_PRESET,
    }),
    [
      preset,
      savedPreset,
      library,
      savedLibrary,
      activeCustom,
      setPreset,
      commitPreset,
      commitSelection,
      selectTheme,
      createTheme,
      updateActiveConfig,
      renameActiveTheme,
      deleteTheme,
      savePreset,
      resetPreview,
      isDirty,
      isSaving,
    ],
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
