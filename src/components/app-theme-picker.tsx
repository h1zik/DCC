"use client";

import { useEffect, useRef } from "react";
import { Palette } from "lucide-react";
import { useAppTheme } from "@/components/app-theme-provider";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  APP_THEME_PRESETS,
  APP_THEME_PRESET_IDS,
  applyAppThemeToDocument,
} from "@/lib/app-themes";
import { cn } from "@/lib/utils";

function ThemeSwatches({ colors }: { colors: readonly [string, string, string] }) {
  return (
    <div className="relative mx-auto flex h-10 w-[4.5rem] items-center justify-center">
      {colors.map((color, i) => (
        <span
          key={color}
          className="absolute size-7 rounded-full border-2 border-background shadow-sm"
          style={{
            backgroundColor: color,
            left: `${i * 18}px`,
            zIndex: 3 - i,
          }}
          aria-hidden
        />
      ))}
    </div>
  );
}

export function AppThemePicker() {
  const { preset, savedPreset, setPreset, savePreset, resetPreview, isDirty, isSaving } =
    useAppTheme();
  const presetRef = useRef(preset);
  const savedPresetRef = useRef(savedPreset);
  presetRef.current = preset;
  savedPresetRef.current = savedPreset;

  // Revert unsaved preview only on unmount (navigate away), not after save.
  useEffect(() => {
    return () => {
      if (presetRef.current !== savedPresetRef.current) {
        applyAppThemeToDocument(savedPresetRef.current);
      }
    };
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Palette className="size-4" />
          Tampilan Aplikasi
        </CardTitle>
        <CardDescription>
          Ubah warna seluruh aplikasi — sidebar, tombol, dan latar. Klik kartu
          untuk pratinjau, lalu simpan.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-primary mb-3 text-sm font-medium">Tema Default</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {APP_THEME_PRESET_IDS.map((id) => {
              const theme = APP_THEME_PRESETS[id];
              const active = preset === id;
              return (
                <ThemeCard
                  key={id}
                  label={theme.label}
                  swatches={theme.swatches}
                  active={active}
                  onSelect={() => setPreset(id)}
                />
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            onClick={savePreset}
            disabled={!isDirty || isSaving}
          >
            {isSaving ? "Menyimpan…" : "Simpan tema"}
          </Button>
          {isDirty ? (
            <Button
              type="button"
              variant="outline"
              onClick={resetPreview}
              disabled={isSaving}
            >
              Batalkan
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function ThemeCard({
  label,
  swatches,
  active,
  onSelect,
}: {
  label: string;
  swatches: readonly [string, string, string];
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      aria-label={`Tema ${label}`}
      className={cn(
        "flex flex-col items-center gap-2 rounded-xl border p-3 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "border-primary shadow-[0_0_12px_color-mix(in_oklab,var(--primary)_50%,transparent)] ring-2 ring-primary/60"
          : "border-primary/40 hover:border-primary/70",
      )}
    >
      <ThemeSwatches colors={swatches} />
      <span className="text-primary text-sm font-medium">{label}</span>
    </button>
  );
}
