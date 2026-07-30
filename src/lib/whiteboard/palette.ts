import type { WhiteboardColorToken } from "./types";

/**
 * Palet warna whiteboard.
 *
 * Warna disimpan sebagai token di database, lalu diresolusi ke hex saat
 * render. Alasannya dua: (1) papan ikut menyesuaikan tema terang/gelap tanpa
 * mengubah data, dan (2) ekspor PNG/SVG cukup memakai hex hasil resolusi
 * sehingga tidak bergantung pada CSS variable yang tidak ikut terbawa.
 *
 * `surface` = warna isi (sticky/bentuk), `soft` = isi versi transparan,
 * `ink` = garis tepi & teks di atas latar papan, `on` = warna teks yang
 * kontras di atas `surface`.
 */

export type PaletteEntry = {
  label: string;
  surface: string;
  soft: string;
  ink: string;
  on: string;
};

type PaletteMap = Record<WhiteboardColorToken, PaletteEntry>;

const LIGHT: PaletteMap = {
  slate: { label: "Slate", surface: "#e2e8f0", soft: "#f1f5f9", ink: "#334155", on: "#0f172a" },
  gray: { label: "Abu", surface: "#e5e7eb", soft: "#f3f4f6", ink: "#4b5563", on: "#111827" },
  red: { label: "Merah", surface: "#fecaca", soft: "#fee2e2", ink: "#dc2626", on: "#7f1d1d" },
  orange: { label: "Oranye", surface: "#fed7aa", soft: "#ffedd5", ink: "#ea580c", on: "#7c2d12" },
  amber: { label: "Amber", surface: "#fde68a", soft: "#fef3c7", ink: "#d97706", on: "#78350f" },
  yellow: { label: "Kuning", surface: "#fef08a", soft: "#fefce8", ink: "#ca8a04", on: "#713f12" },
  lime: { label: "Lime", surface: "#d9f99d", soft: "#ecfccb", ink: "#65a30d", on: "#365314" },
  green: { label: "Hijau", surface: "#bbf7d0", soft: "#dcfce7", ink: "#16a34a", on: "#14532d" },
  teal: { label: "Teal", surface: "#99f6e4", soft: "#ccfbf1", ink: "#0d9488", on: "#134e4a" },
  cyan: { label: "Cyan", surface: "#a5f3fc", soft: "#cffafe", ink: "#0891b2", on: "#164e63" },
  blue: { label: "Biru", surface: "#bfdbfe", soft: "#dbeafe", ink: "#2563eb", on: "#1e3a8a" },
  indigo: { label: "Indigo", surface: "#c7d2fe", soft: "#e0e7ff", ink: "#4f46e5", on: "#312e81" },
  violet: { label: "Violet", surface: "#ddd6fe", soft: "#ede9fe", ink: "#7c3aed", on: "#4c1d95" },
  purple: { label: "Ungu", surface: "#e9d5ff", soft: "#f3e8ff", ink: "#9333ea", on: "#581c87" },
  pink: { label: "Pink", surface: "#fbcfe8", soft: "#fce7f3", ink: "#db2777", on: "#831843" },
  rose: { label: "Rose", surface: "#fecdd3", soft: "#ffe4e6", ink: "#e11d48", on: "#881337" },
  black: { label: "Hitam", surface: "#1e1e1e", soft: "#3f3f46", ink: "#18181b", on: "#ffffff" },
  white: { label: "Putih", surface: "#ffffff", soft: "#fafafa", ink: "#d4d4d8", on: "#18181b" },
  transparent: { label: "Tanpa isi", surface: "transparent", soft: "transparent", ink: "transparent", on: "#18181b" },
};

/**
 * Versi gelap: `surface` diredupkan agar tidak menyilaukan, `ink` dicerahkan
 * agar tetap terbaca di atas kanvas gelap.
 */
const DARK: PaletteMap = {
  slate: { label: "Slate", surface: "#334155", soft: "#1e293b", ink: "#cbd5e1", on: "#f8fafc" },
  gray: { label: "Abu", surface: "#3f3f46", soft: "#27272a", ink: "#d4d4d8", on: "#fafafa" },
  red: { label: "Merah", surface: "#7f1d1d", soft: "#450a0a", ink: "#fca5a5", on: "#fef2f2" },
  orange: { label: "Oranye", surface: "#7c2d12", soft: "#431407", ink: "#fdba74", on: "#fff7ed" },
  amber: { label: "Amber", surface: "#78350f", soft: "#451a03", ink: "#fcd34d", on: "#fffbeb" },
  yellow: { label: "Kuning", surface: "#713f12", soft: "#422006", ink: "#fde047", on: "#fefce8" },
  lime: { label: "Lime", surface: "#365314", soft: "#1a2e05", ink: "#bef264", on: "#f7fee7" },
  green: { label: "Hijau", surface: "#14532d", soft: "#052e16", ink: "#86efac", on: "#f0fdf4" },
  teal: { label: "Teal", surface: "#134e4a", soft: "#042f2e", ink: "#5eead4", on: "#f0fdfa" },
  cyan: { label: "Cyan", surface: "#164e63", soft: "#083344", ink: "#67e8f9", on: "#ecfeff" },
  blue: { label: "Biru", surface: "#1e3a8a", soft: "#172554", ink: "#93c5fd", on: "#eff6ff" },
  indigo: { label: "Indigo", surface: "#312e81", soft: "#1e1b4b", ink: "#a5b4fc", on: "#eef2ff" },
  violet: { label: "Violet", surface: "#4c1d95", soft: "#2e1065", ink: "#c4b5fd", on: "#f5f3ff" },
  purple: { label: "Ungu", surface: "#581c87", soft: "#3b0764", ink: "#d8b4fe", on: "#faf5ff" },
  pink: { label: "Pink", surface: "#831843", soft: "#500724", ink: "#f9a8d4", on: "#fdf2f8" },
  rose: { label: "Rose", surface: "#881337", soft: "#4c0519", ink: "#fda4af", on: "#fff1f2" },
  black: { label: "Hitam", surface: "#09090b", soft: "#18181b", ink: "#e4e4e7", on: "#fafafa" },
  white: { label: "Putih", surface: "#e4e4e7", soft: "#a1a1aa", ink: "#52525b", on: "#18181b" },
  transparent: { label: "Tanpa isi", surface: "transparent", soft: "transparent", ink: "transparent", on: "#fafafa" },
};

export function palette(dark: boolean): PaletteMap {
  return dark ? DARK : LIGHT;
}

export function paletteEntry(
  token: WhiteboardColorToken | undefined,
  dark: boolean,
  fallback: WhiteboardColorToken = "slate",
): PaletteEntry {
  const map = dark ? DARK : LIGHT;
  return map[token ?? fallback] ?? map[fallback];
}

/**
 * Warna isi sebuah elemen sesuai gaya isian yang dipilih.
 * `hachure` dirender sebagai pattern di komponen, jadi di sini dikembalikan
 * warna dasarnya saja.
 */
export function resolveFill(
  token: WhiteboardColorToken | undefined,
  fillStyle: string | undefined,
  dark: boolean,
): string {
  if (!token || token === "transparent" || fillStyle === "none") return "none";
  const entry = paletteEntry(token, dark);
  return fillStyle === "soft" ? entry.soft : entry.surface;
}

export function resolveStroke(
  token: WhiteboardColorToken | undefined,
  dark: boolean,
): string {
  if (!token || token === "transparent") return "none";
  return paletteEntry(token, dark).ink;
}

/**
 * Warna teks. Untuk sticky/bentuk berisi, teks otomatis memakai warna yang
 * kontras terhadap isinya kalau penggunanya belum mengubah warna teks.
 */
export function resolveText(
  token: WhiteboardColorToken | undefined,
  dark: boolean,
): string {
  const entry = paletteEntry(token, dark, "slate");
  if (token === "transparent") return dark ? "#fafafa" : "#18181b";
  return entry.on;
}

/** Urutan token yang ditampilkan di picker warna (tanpa `transparent`). */
export const PALETTE_ORDER: WhiteboardColorToken[] = [
  "yellow",
  "amber",
  "orange",
  "red",
  "rose",
  "pink",
  "purple",
  "violet",
  "indigo",
  "blue",
  "cyan",
  "teal",
  "green",
  "lime",
  "slate",
  "gray",
  "black",
  "white",
];

/** Warna sticky yang ditawarkan di quick-pick toolbar sticky. */
export const STICKY_PALETTE: WhiteboardColorToken[] = [
  "yellow",
  "amber",
  "orange",
  "rose",
  "pink",
  "violet",
  "blue",
  "cyan",
  "green",
  "lime",
  "slate",
  "white",
];

/** Warna kursor peserta — dipilih deterministik dari user id. */
const CURSOR_COLORS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#14b8a6",
  "#06b6d4",
  "#3b82f6",
  "#6366f1",
  "#8b5cf6",
  "#d946ef",
  "#ec4899",
  "#f43f5e",
];

export function cursorColorFor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i += 1) {
    hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  }
  return CURSOR_COLORS[hash % CURSOR_COLORS.length]!;
}
