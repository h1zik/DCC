import { describe, expect, it } from "vitest";
import {
  DEFAULT_CUSTOM_THEME,
  generateThemeVars,
  hexToOklch,
} from "@/lib/theme-generator";

function config(accent: string, bg = "#15141A") {
  return { ...DEFAULT_CUSTOM_THEME, accent, bg };
}

describe("generateThemeVars", () => {
  it("keeps a white accent neutral instead of adding a yellow tint", () => {
    const vars = generateThemeVars(config("#FFFFFF"));

    expect(vars["--primary"]).toBe("oklch(1.000 0.000 0.0)");
    expect(vars["--primary-foreground"]).toBe("oklch(0.180 0.000 0.0)");
    expect(vars["--ring"]).toBe(vars["--primary"]);
    expect(vars["--chart-1"]).toBe("oklch(0.780 0.000 0.0)");
    expect(vars["--accent"]).toBe("oklch(0.320 0.000 0.0)");
  });

  it("keeps black and gray accents neutral", () => {
    const black = generateThemeVars(config("#000000"));
    const gray = generateThemeVars(config("#808080"));

    expect(black["--primary"]).toBe("oklch(0.000 0.000 0.0)");
    expect(black["--primary-foreground"]).toBe("oklch(0.990 0.000 0.0)");
    expect(gray["--primary"]).toMatch(/^oklch\([\d.]+ 0\.000 0\.0\)$/);
    expect(gray["--chart-3"]).toMatch(/^oklch\([\d.]+ 0\.000 0\.0\)$/);
  });

  it("preserves the chosen accent lightness and chroma for primary controls", () => {
    const accent = "#E07C3E";
    const selected = hexToOklch(accent);
    const vars = generateThemeVars(config(accent, "#FAFAF9"));

    expect(vars["--primary"]).toBe(
      `oklch(${selected.L.toFixed(3)} ${selected.C.toFixed(3)} ${selected.H.toFixed(1)})`,
    );
  });

  it("chooses the higher-contrast foreground for the selected color", () => {
    const brightGreen = generateThemeVars(config("#16A34A"));
    const darkBlue = generateThemeVars(config("#1E3A8A"));

    expect(brightGreen["--primary-foreground"]).toBe(
      "oklch(0.180 0.000 0.0)",
    );
    expect(darkBlue["--primary-foreground"]).toBe(
      "oklch(0.990 0.000 0.0)",
    );
  });
});
