"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Check, Moon, Palette, Settings2, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { updateAppTheme } from "@/actions/app-theme";
import { useAppTheme } from "@/components/app-theme-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { actionErrorMessage } from "@/lib/action-error-message";
import { cn } from "@/lib/utils";
import {
  APP_THEME_PRESETS,
  APP_THEME_PRESET_IDS,
  type AppThemePreset,
} from "@/lib/app-themes";
import type { SavedTheme } from "@/lib/theme-generator";

function PresetDots({
  swatches,
}: {
  swatches: readonly [string, string, string];
}) {
  return (
    <span className="flex shrink-0 -space-x-1" aria-hidden>
      {swatches.map((color, i) => (
        <span
          key={`${color}-${i}`}
          className="border-background size-3.5 rounded-full border shadow-sm"
          style={{ backgroundColor: color, zIndex: 3 - i }}
        />
      ))}
    </span>
  );
}

export function ThemeMenu({ className }: { className?: string }) {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const {
    savedPreset,
    library,
    setPreset,
    selectTheme,
    commitSelection,
    resetPreview,
  } = useAppTheme();
  const [saving, startSave] = useTransition();

  function choosePreset(id: Exclude<AppThemePreset, "custom">) {
    if (id === savedPreset) return;
    setPreset(id); // pratinjau instan sebelum persist
    startSave(async () => {
      try {
        await updateAppTheme(id);
        commitSelection(id);
        router.refresh();
        toast.success(`Tema ${APP_THEME_PRESETS[id].label} diaktifkan.`);
      } catch (err) {
        resetPreview();
        toast.error(actionErrorMessage(err, "Gagal mengubah tema."));
      }
    });
  }

  function chooseCustom(theme: SavedTheme) {
    if (savedPreset === "custom" && library.activeId === theme.id) return;
    const nextLib = { ...library, activeId: theme.id };
    selectTheme(theme.id); // pratinjau instan
    startSave(async () => {
      try {
        await updateAppTheme("custom", nextLib);
        commitSelection("custom", nextLib);
        router.refresh();
        toast.success(`Tema ${theme.name} diaktifkan.`);
      } catch (err) {
        resetPreview();
        toast.error(actionErrorMessage(err, "Gagal mengubah tema."));
      }
    });
  }

  const activeSwatch =
    savedPreset === "custom"
      ? undefined
      : APP_THEME_PRESETS[savedPreset]?.swatches[2];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            className={cn("relative shrink-0", className)}
            aria-label="Ganti tema aplikasi"
            title="Tema aplikasi"
          >
            <Palette />
            <span
              className="border-background absolute right-1 bottom-1 size-2 rounded-full border"
              style={{ backgroundColor: activeSwatch ?? "var(--primary)" }}
              aria-hidden
            />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Tema aplikasi</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={savedPreset}>
            {APP_THEME_PRESET_IDS.map((id) => (
              <DropdownMenuRadioItem
                key={id}
                value={id}
                disabled={saving}
                onClick={() => choosePreset(id)}
              >
                <PresetDots swatches={APP_THEME_PRESETS[id].swatches} />
                {APP_THEME_PRESETS[id].label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>

        {savedPreset === "original" ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel>Mode Original</DropdownMenuLabel>
              <DropdownMenuItem
                closeOnClick={false}
                onClick={() => setTheme("light")}
              >
                <Sun />
                Terang
                {resolvedTheme === "light" ? (
                  <Check className="ml-auto" />
                ) : null}
              </DropdownMenuItem>
              <DropdownMenuItem
                closeOnClick={false}
                onClick={() => setTheme("dark")}
              >
                <Moon />
                Gelap
                {resolvedTheme === "dark" ? <Check className="ml-auto" /> : null}
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </>
        ) : null}

        {library.themes.length > 0 ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel>Tema saya</DropdownMenuLabel>
              {library.themes.map((theme) => {
                const active =
                  savedPreset === "custom" && library.activeId === theme.id;
                return (
                  <DropdownMenuItem
                    key={theme.id}
                    disabled={saving}
                    onClick={() => chooseCustom(theme)}
                  >
                    <span
                      className="border-background size-3.5 shrink-0 rounded-full border shadow-sm"
                      style={{ backgroundColor: theme.config.accent }}
                      aria-hidden
                    />
                    <span className="truncate">{theme.name}</span>
                    {active ? <Check className="ml-auto shrink-0" /> : null}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuGroup>
          </>
        ) : null}

        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/profile/edit" />}>
          <Settings2 />
          Kustomisasi tema…
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
