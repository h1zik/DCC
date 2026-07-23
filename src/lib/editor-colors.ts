/**
 * Palet warna editor wiki. Nilai hex literal (bukan token tema) karena warna
 * ikut tersimpan di HTML konten — harus terbaca di light & dark mode.
 */
export type EditorColorSwatch = { label: string; value: string };
export type EditorHighlightSwatch = EditorColorSwatch & {
  /** Fallback solid untuk pipeline yang tidak mendukung hex 8 digit (DOCX). */
  solid: string;
};

export const WIKI_TEXT_COLORS: EditorColorSwatch[] = [
  { label: "Abu-abu", value: "#6b7280" },
  { label: "Cokelat", value: "#92400e" },
  { label: "Oranye", value: "#ea580c" },
  { label: "Kuning", value: "#ca8a04" },
  { label: "Hijau", value: "#16a34a" },
  { label: "Biru", value: "#2563eb" },
  { label: "Ungu", value: "#9333ea" },
  { label: "Merah muda", value: "#db2777" },
  { label: "Merah", value: "#dc2626" },
];

export const WIKI_HIGHLIGHT_COLORS: EditorHighlightSwatch[] = [
  { label: "Kuning", value: "#facc1559", solid: "#fef9c3" },
  { label: "Hijau", value: "#4ade8059", solid: "#dcfce7" },
  { label: "Biru", value: "#60a5fa59", solid: "#dbeafe" },
  { label: "Ungu", value: "#c084fc59", solid: "#f3e8ff" },
  { label: "Merah muda", value: "#f472b659", solid: "#fce7f3" },
  { label: "Merah", value: "#f8717159", solid: "#fee2e2" },
  { label: "Oranye", value: "#fb923c59", solid: "#ffedd5" },
  { label: "Abu-abu", value: "#9ca3af4d", solid: "#f3f4f6" },
];

/** Petakan warna highlight (hex 8 digit) ke fallback solid; selain itu apa adanya. */
export function solidHighlightColor(value: string): string {
  const match = WIKI_HIGHLIGHT_COLORS.find(
    (swatch) => swatch.value.toLowerCase() === value.trim().toLowerCase(),
  );
  if (match) return match.solid;
  // Hex 8/4 digit generik: buang kanal alpha agar tetap valid di renderer lama.
  const hex = /^#([0-9a-fA-F]{6})[0-9a-fA-F]{2}$/.exec(value.trim());
  if (hex) return `#${hex[1]}`;
  const shortHex = /^#([0-9a-fA-F]{3})[0-9a-fA-F]$/.exec(value.trim());
  if (shortHex) return `#${shortHex[1]}`;
  return value;
}
