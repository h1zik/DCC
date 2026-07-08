"use client";

/**
 * Sampling warna TEMA aktif untuk efek WebGL/canvas — tema-agnostic. Membaca
 * token CSS (`--primary`, `--accent`, `--chart-*`) via getComputedStyle lalu
 * meraster ke sRGB dengan canvas 1×1 (robust terhadap oklch/color()). Re-sample
 * saat tema berubah (MutationObserver pada <html>: class / style / data-theme).
 */
import { useEffect, useRef, useState } from "react";

export type RGB = [number, number, number];

export const DEFAULT_THEME_TOKENS = [
  "--primary",
  "--accent",
  "--chart-1",
  "--chart-2",
  "--chart-3",
  "--chart-4",
] as const;

const NEUTRAL: RGB = [0.5, 0.5, 0.5];

export function sampleThemeColors(tokens: readonly string[]): RGB[] {
  if (typeof document === "undefined") return tokens.map(() => NEUTRAL);
  const probe = document.createElement("span");
  probe.style.cssText = "display:none;position:absolute;pointer-events:none";
  document.body.appendChild(probe);
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const out = tokens.map((token) => {
    try {
      probe.style.color = "";
      probe.style.color = `var(${token})`;
      const resolved = getComputedStyle(probe).color;
      if (!ctx || !resolved) return NEUTRAL;
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = "#000";
      ctx.fillStyle = resolved; // browser parses rgb/oklch/color()
      ctx.fillRect(0, 0, 1, 1);
      const d = ctx.getImageData(0, 0, 1, 1).data;
      return [d[0] / 255, d[1] / 255, d[2] / 255] as RGB;
    } catch {
      return NEUTRAL;
    }
  });
  probe.remove();
  return out;
}

/** Warna tema reaktif (re-sample saat tema berubah). */
export function useThemeColors(
  tokens: readonly string[] = DEFAULT_THEME_TOKENS,
): RGB[] {
  const key = tokens.join(",");
  const [colors, setColors] = useState<RGB[]>(() => tokens.map(() => NEUTRAL));
  const raf = useRef<number | null>(null);

  useEffect(() => {
    const resample = () => setColors(sampleThemeColors(tokens));
    // Debounce lewat rAF (juga membuat sampling awal async — bukan setState
    // sinkron di body effect).
    const schedule = () => {
      if (raf.current != null) cancelAnimationFrame(raf.current);
      raf.current = requestAnimationFrame(resample);
    };
    schedule();
    const mo = new MutationObserver(schedule);
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "style", "data-theme"],
    });
    return () => {
      mo.disconnect();
      if (raf.current != null) cancelAnimationFrame(raf.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return colors;
}
