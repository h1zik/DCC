"use client";

import { useEffect, useRef } from "react";
import { Check, Palette, Plus, Trash2 } from "lucide-react";
import { useAppTheme } from "@/components/app-theme-provider";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  APP_THEME_PRESETS,
  APP_THEME_PRESET_IDS,
  applyAppThemeToDocument,
} from "@/lib/app-themes";
import {
  activeCustomConfig,
  isConfigDark,
  THEME_ACCENT_PRESETS,
  THEME_BG_PRESETS,
  THEME_FONTS,
  type CustomThemeConfig,
  type SavedTheme,
  type ThemeFontKey,
  type ThemeRadius,
} from "@/lib/theme-generator";
import { cn } from "@/lib/utils";

function ThemeSwatches({ colors }: { colors: readonly [string, string, string] }) {
  return (
    <div className="relative mx-auto flex h-10 w-[4.5rem] items-center justify-center">
      {colors.map((color, i) => (
        <span
          key={color}
          className="border-background absolute size-7 rounded-full border-2 shadow-sm"
          style={{ backgroundColor: color, left: `${i * 18}px`, zIndex: 3 - i }}
          aria-hidden
        />
      ))}
    </div>
  );
}

export function AppThemePicker() {
  const {
    preset,
    savedPreset,
    library,
    savedLibrary,
    activeCustom,
    setPreset,
    selectTheme,
    createTheme,
    updateActiveConfig,
    renameActiveTheme,
    deleteTheme,
    savePreset,
    resetPreview,
    isDirty,
    isSaving,
  } = useAppTheme();

  // Revert pratinjau yang belum disimpan saat pindah halaman.
  const liveRef = useRef({ preset, library, savedPreset, savedLibrary });
  useEffect(() => {
    liveRef.current = { preset, library, savedPreset, savedLibrary };
  });
  useEffect(() => {
    return () => {
      const s = liveRef.current;
      const dirty =
        s.preset !== s.savedPreset ||
        JSON.stringify(s.library) !== JSON.stringify(s.savedLibrary);
      if (dirty) {
        applyAppThemeToDocument(
          s.savedPreset,
          activeCustomConfig(s.savedLibrary),
        );
      }
    };
  }, []);

  const isCustom = preset === "custom";
  const activeTheme = library.themes.find((t) => t.id === library.activeId);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Palette className="size-4" />
          Tampilan Aplikasi
        </CardTitle>
        <CardDescription>
          Pilih tema jadi, atau racik & simpan tema sendiri. Klik untuk pratinjau
          langsung, lalu simpan.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <section>
          <p className="text-muted-foreground mb-3 text-xs font-semibold tracking-wide uppercase">
            Tema jadi
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {APP_THEME_PRESET_IDS.map((id) => {
              const theme = APP_THEME_PRESETS[id];
              return (
                <ThemeCard
                  key={id}
                  label={theme.label}
                  swatches={theme.swatches}
                  active={preset === id}
                  onSelect={() => setPreset(id)}
                />
              );
            })}
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              Tema saya
            </p>
            <Button type="button" size="sm" variant="outline" onClick={createTheme}>
              <Plus className="size-3.5" />
              Tema baru
            </Button>
          </div>

          {library.themes.length === 0 ? (
            <button
              type="button"
              onClick={createTheme}
              className="border-primary/40 text-muted-foreground hover:border-primary/70 hover:text-foreground flex w-full flex-col items-center gap-1.5 rounded-xl border border-dashed p-6 text-center text-sm transition"
            >
              <Plus className="size-5" />
              Buat tema pertamamu
            </button>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {library.themes.map((t) => (
                <SavedThemeCard
                  key={t.id}
                  theme={t}
                  active={isCustom && library.activeId === t.id}
                  onSelect={() => selectTheme(t.id)}
                  onDelete={() => deleteTheme(t.id)}
                />
              ))}
            </div>
          )}

          {isCustom && activeTheme ? (
            <CustomEditor
              name={activeTheme.name}
              config={activeCustom}
              onRename={renameActiveTheme}
              onPatch={updateActiveConfig}
            />
          ) : null}
        </section>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" onClick={savePreset} disabled={!isDirty || isSaving}>
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
        "focus-visible:ring-ring flex flex-col items-center gap-2 rounded-xl border p-3 transition focus-visible:ring-2 focus-visible:outline-none",
        active
          ? "border-primary ring-primary/60 shadow-[0_0_12px_color-mix(in_oklab,var(--primary)_50%,transparent)] ring-2"
          : "border-primary/40 hover:border-primary/70",
      )}
    >
      <ThemeSwatches colors={swatches} />
      <span className="text-primary text-sm font-medium">{label}</span>
    </button>
  );
}

function SavedThemeCard({
  theme,
  active,
  onSelect,
  onDelete,
}: {
  theme: SavedTheme;
  active: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const dark = isConfigDark(theme.config);
  return (
    <div
      className={cn(
        "group relative rounded-xl border p-1.5 transition",
        active
          ? "border-primary ring-primary/60 shadow-[0_0_12px_color-mix(in_oklab,var(--primary)_45%,transparent)] ring-2"
          : "border-border hover:border-primary/60",
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={active}
        aria-label={`Pakai tema ${theme.name}`}
        className="focus-visible:ring-ring block w-full rounded-lg focus-visible:ring-2 focus-visible:outline-none"
      >
        <span
          className="relative flex h-12 items-center justify-center gap-1.5 overflow-hidden rounded-lg border"
          style={{ backgroundColor: theme.config.bg }}
        >
          <span
            className="size-5 rounded-full shadow-sm"
            style={{ backgroundColor: theme.config.accent }}
          />
          <span
            className="text-xs font-semibold"
            style={{ color: dark ? "#f5f5f5" : "#1a1a1a" }}
          >
            Aa
          </span>
        </span>
        <span className="text-foreground mt-1.5 block truncate px-0.5 text-xs font-medium">
          {theme.name}
        </span>
      </button>
      {active ? (
        <Check className="text-primary absolute top-2 left-2 size-3.5" />
      ) : null}
      <button
        type="button"
        onClick={onDelete}
        aria-label={`Hapus tema ${theme.name}`}
        title="Hapus tema"
        className="bg-background/85 text-muted-foreground hover:text-destructive absolute top-1.5 right-1.5 grid size-6 place-items-center rounded-md border opacity-0 backdrop-blur transition group-hover:opacity-100 focus-visible:opacity-100"
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  );
}

/* ------------------------------ Custom editor ----------------------------- */

function EditorRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-foreground text-xs font-semibold">{label}</p>
      {hint ? (
        <p className="text-muted-foreground -mt-1 text-[11px]">{hint}</p>
      ) : null}
      {children}
    </div>
  );
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { v: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="border-border bg-background inline-flex flex-wrap rounded-lg border p-0.5">
      {options.map((o) => (
        <button
          key={o.v}
          type="button"
          aria-pressed={value === o.v}
          onClick={() => onChange(o.v)}
          className={cn(
            "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
            value === o.v
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function SwatchButton({
  color,
  selected,
  onClick,
  label,
}: {
  color: string;
  selected: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "ring-offset-background size-7 shrink-0 rounded-full ring-2 ring-offset-2 transition-transform hover:scale-105",
        selected ? "ring-primary" : "ring-border/60",
      )}
      style={{ backgroundColor: color }}
    />
  );
}

function FontSelect({
  value,
  onChange,
  label,
}: {
  value: ThemeFontKey;
  onChange: (v: ThemeFontKey) => void;
  label: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-muted-foreground text-[11px] font-medium">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as ThemeFontKey)}
        className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/40 h-9 rounded-lg border px-2.5 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
      >
        {THEME_FONTS.map((f) => (
          <option key={f.key} value={f.key}>
            {f.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function CustomEditor({
  name,
  config,
  onRename,
  onPatch,
}: {
  name: string;
  config: CustomThemeConfig;
  onRename: (name: string) => void;
  onPatch: (patch: Partial<CustomThemeConfig>) => void;
}) {
  const dark = isConfigDark(config);
  return (
    <div className="border-border/60 bg-muted/20 mt-3 grid gap-4 rounded-xl border p-4">
      <EditorRow label="Nama tema">
        <Input
          value={name}
          onChange={(e) => onRename(e.target.value)}
          maxLength={40}
          placeholder="Mis. Umella Magenta"
          className="h-9"
        />
      </EditorRow>

      <EditorRow
        label="Warna latar"
        hint="Pilih warna bebas — teks & kartu otomatis menyesuaikan agar terbaca."
      >
        <div className="flex flex-col gap-2.5">
          <Segmented
            value={dark ? "dark" : "light"}
            onChange={(v) =>
              onPatch({
                bg: v === "dark" ? THEME_BG_PRESETS.dark[0] : THEME_BG_PRESETS.light[0],
              })
            }
            options={[
              { v: "light", label: "Terang" },
              { v: "dark", label: "Gelap" },
            ]}
          />
          <div className="flex flex-wrap items-center gap-2">
            {(dark ? THEME_BG_PRESETS.dark : THEME_BG_PRESETS.light).map((c) => (
              <SwatchButton
                key={c}
                color={c}
                label={`Latar ${c}`}
                selected={config.bg.toUpperCase() === c.toUpperCase()}
                onClick={() => onPatch({ bg: c })}
              />
            ))}
            <input
              type="color"
              value={config.bg.toLowerCase()}
              onChange={(e) => onPatch({ bg: e.target.value.toUpperCase() })}
              className="size-8 shrink-0 cursor-pointer rounded-md border-0 p-0.5"
              title="Warna latar kustom"
              aria-label="Warna latar kustom"
            />
            <span className="text-muted-foreground font-mono text-xs">
              {config.bg.toUpperCase()}
            </span>
          </div>
        </div>
      </EditorRow>

      <EditorRow
        label="Warna aksen"
        hint="Menggerakkan tombol, sidebar aktif, chip, fokus & chart."
      >
        <div className="flex flex-wrap items-center gap-2">
          {THEME_ACCENT_PRESETS.map((c) => (
            <SwatchButton
              key={c}
              color={c}
              label={`Aksen ${c}`}
              selected={config.accent.toUpperCase() === c}
              onClick={() => onPatch({ accent: c })}
            />
          ))}
          <input
            type="color"
            value={config.accent.toLowerCase()}
            onChange={(e) => onPatch({ accent: e.target.value.toUpperCase() })}
            className="size-8 shrink-0 cursor-pointer rounded-md border-0 p-0.5"
            title="Warna aksen kustom"
            aria-label="Warna aksen kustom"
          />
          <span className="text-muted-foreground font-mono text-xs">
            {config.accent.toUpperCase()}
          </span>
        </div>
      </EditorRow>

      <EditorRow label="Kelengkungan">
        <Segmented<ThemeRadius>
          value={config.radius}
          onChange={(radius) => onPatch({ radius })}
          options={[
            { v: "sharp", label: "Tajam" },
            { v: "default", label: "Default" },
            { v: "rounded", label: "Bulat" },
            { v: "extra", label: "Ekstra" },
          ]}
        />
      </EditorRow>

      <EditorRow label="Font">
        <div className="grid grid-cols-2 gap-3">
          <FontSelect
            label="Teks"
            value={config.fontBody}
            onChange={(fontBody) => onPatch({ fontBody })}
          />
          <FontSelect
            label="Judul"
            value={config.fontHeading}
            onChange={(fontHeading) => onPatch({ fontHeading })}
          />
        </div>
      </EditorRow>

      {/* Pratinjau ringkas — token di bawah ikut tema yang sedang diracik. */}
      <div className="border-border bg-card space-y-3 rounded-lg border p-3">
        <p className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
          Pratinjau
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <span className="bg-primary text-primary-foreground inline-flex items-center rounded-md px-3 py-1.5 text-xs font-semibold">
            Tombol
          </span>
          <span className="border-border text-foreground inline-flex items-center rounded-md border px-3 py-1.5 text-xs font-medium">
            Outline
          </span>
          <span className="bg-accent text-accent-foreground rounded-full px-2.5 py-0.5 text-[11px] font-semibold">
            chip
          </span>
          <span className="bg-muted text-muted-foreground rounded-full px-2.5 py-0.5 text-[11px] font-medium">
            netral
          </span>
        </div>
        <div className="border-ring ring-ring/50 flex items-center gap-2 rounded-md border px-3 py-2 ring-2">
          <span className="text-muted-foreground text-xs">Cari sesuatu…</span>
        </div>
        <div className="flex items-end gap-1.5" aria-hidden>
          {[40, 65, 30, 85, 55].map((h, i) => (
            <span
              key={i}
              className="flex-1 rounded-t"
              style={{
                height: `${h * 0.5}px`,
                backgroundColor: `var(--chart-${i + 1})`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
