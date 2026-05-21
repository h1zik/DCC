import { Extension } from "@tiptap/core";

/** Ukuran font inline via mark `textStyle` (butuh `@tiptap/extension-text-style`). */
export const FontSize = Extension.create({
  name: "fontSize",

  addOptions() {
    return {
      types: ["textStyle"] as const,
    };
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element) => {
              const size = element.style.fontSize;
              return size?.replace(/['"]+/g, "") || null;
            },
            renderHTML: (attributes) => {
              if (!attributes.fontSize) return {};
              return { style: `font-size: ${attributes.fontSize}` };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setFontSize:
        (fontSize: string) =>
        ({ chain }) =>
          chain().setMark("textStyle", { fontSize }).run(),
      unsetFontSize:
        () =>
        ({ chain }) =>
          chain()
            .setMark("textStyle", { fontSize: null })
            .removeEmptyTextStyle()
            .run(),
    };
  },
});

/** Default isi editor (pt), selaras gaya Google Docs. */
export const DEFAULT_FONT_SIZE_PT = 11;

export const FONT_SIZE_MIN_PT = 1;
export const FONT_SIZE_MAX_PT = 400;

/** Ambil angka dari nilai CSS `12pt` / `16px` untuk ditampilkan di input. */
export function fontSizeCSSValueToNumber(
  raw: string | null | undefined,
): number | null {
  if (!raw?.trim()) return null;
  const m = /^([\d.]+)\s*(px|pt)?$/i.exec(raw.trim());
  if (!m) return null;
  const n = Number.parseFloat(m[1]!);
  if (!Number.isFinite(n) || n <= 0) return null;
  const unit = (m[2] ?? "pt").toLowerCase();
  if (unit === "px") {
    return Math.round((n * 72) / 96 * 10) / 10;
  }
  return Math.round(n * 10) / 10;
}

/** Nilai input pengguna → CSS (pakai `pt` seperti Google Docs). */
export function numberToFontSizeCSSValue(n: number): string {
  const clamped = Math.min(
    FONT_SIZE_MAX_PT,
    Math.max(FONT_SIZE_MIN_PT, n),
  );
  const rounded =
    Math.abs(clamped - Math.round(clamped)) < 0.01
      ? String(Math.round(clamped))
      : String(Math.round(clamped * 10) / 10);
  return `${rounded}pt`;
}

export function clampFontSizePt(n: number): number {
  return Math.min(FONT_SIZE_MAX_PT, Math.max(FONT_SIZE_MIN_PT, n));
}
