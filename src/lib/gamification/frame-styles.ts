/**
 * Preset frame avatar BERANIMASI (CSS-only, GPU-friendly — hanya `transform`
 * rotate + opsi glow/hue). Satu sumber kebenaran yang dipakai bareng oleh:
 *   - `ProfileAvatarFrame`   → profil live + pratinjau langsung editor
 *   - `MiniBorderPreview`    → swatch kecil di katalog editor
 *
 * Menambah frame baru = tambah satu entri di sini + seed `CosmeticItem`
 * (AVATAR_BORDER) dengan `styleConfig.effect` = key yang sama. Tidak perlu
 * menyentuh komponen render.
 */

export type CssFrameSpec = {
  /** Conic-gradient cincin yang berputar. */
  gradient: string;
  /** Detik per satu rotasi penuh. */
  duration: number;
  /** Putar berlawanan arah jarum jam. */
  reverse?: boolean;
  /** Warna halo/glow luar (dipakai box-shadow). */
  halo: string;
  /** Tambah lapisan glow "bernapas" (pulse). */
  pulse?: boolean;
  /** Siklus hue pelan (warna bergeser) — untuk kesan iridesen/aurora. */
  hueCycle?: boolean;
  /** Tebal cincin dalam px. Default 3. */
  thickness?: number;
};

const ACCENT = "var(--profile-accent)";

export const CSS_FRAME_SPECS: Record<string, CssFrameSpec> = {
  // Komet cahaya mengorbit — mengikuti aksen pilihan user.
  "orbit-glow": {
    gradient: `conic-gradient(from 0deg, transparent 0deg, color-mix(in oklab, ${ACCENT} 45%, transparent) 205deg, ${ACCENT} 320deg, color-mix(in oklab, white 88%, ${ACCENT}) 351deg, transparent 360deg)`,
    duration: 6,
    halo: ACCENT,
  },
  // Iridesen pelangi ala prisma foil.
  foil: {
    gradient:
      "conic-gradient(from 0deg, #ff5d8f, #ffd166, #06d6a0, #4cc9f0, #b892ff, #ff5d8f)",
    duration: 9,
    halo: "#4cc9f0",
  },
  // Tirai aurora — pastel lembut yang bergeser hue pelan + bernapas.
  aurora: {
    gradient:
      "conic-gradient(from 0deg, #5eead4, #818cf8, #f0abfc, #5eead4)",
    duration: 14,
    hueCycle: true,
    pulse: true,
    halo: "#818cf8",
    thickness: 4,
  },
  // Bara api — merah → oranye → emas, berputar cepat & berkedip.
  ember: {
    gradient:
      "conic-gradient(from 0deg, #7f1d1d, #ef4444, #f59e0b, #fde047, #ef4444, #7f1d1d)",
    duration: 5,
    reverse: true,
    pulse: true,
    halo: "#f97316",
  },
  // Halo beku — kilau es sian/putih dengan sorot terang.
  frost: {
    gradient:
      "conic-gradient(from 0deg, color-mix(in oklab, #a5f3fc 30%, transparent) 0deg, #67e8f9 180deg, #ffffff 320deg, #e0f2fe 350deg, color-mix(in oklab, #a5f3fc 30%, transparent) 360deg)",
    duration: 10,
    halo: "#67e8f9",
  },
  // Nadi neon — cincin aksen yang bernapas dengan inti terang.
  "neon-pulse": {
    gradient: `conic-gradient(from 0deg, color-mix(in oklab, ${ACCENT} 20%, transparent), ${ACCENT}, color-mix(in oklab, white 70%, ${ACCENT}), ${ACCENT}, color-mix(in oklab, ${ACCENT} 20%, transparent))`,
    duration: 8,
    pulse: true,
    halo: ACCENT,
  },
  // Senja — merah muda → oranye → ungu hangat.
  sunset: {
    gradient:
      "conic-gradient(from 0deg, #f472b6, #fb923c, #facc15, #fb7185, #a855f7, #f472b6)",
    duration: 12,
    halo: "#fb7185",
  },
  // Bisa/toxic — hijau → limau menyala, berputar mundur & berpendar.
  venom: {
    gradient:
      "conic-gradient(from 0deg, color-mix(in oklab, #052e16 60%, transparent) 0deg, #22c55e 170deg, #a3e635 300deg, #ecfccb 345deg, color-mix(in oklab, #052e16 40%, transparent) 360deg)",
    duration: 7,
    reverse: true,
    pulse: true,
    halo: "#22c55e",
  },
  // Emas mewah — kilau gold dengan sorot putih.
  "gold-luxe": {
    gradient:
      "conic-gradient(from 0deg, #7c5e10, #b8860b, #fde68a, #fffbeb, #fcd34d, #b8860b, #7c5e10)",
    duration: 8,
    halo: "#fcd34d",
    thickness: 4,
  },
  // Spektrum — pelangi penuh yang juga menyiklus hue (paling mencolok).
  spectrum: {
    gradient:
      "conic-gradient(from 0deg, #ff0040, #ff8c00, #ffe600, #00e676, #00b0ff, #7c4dff, #ff0040)",
    duration: 10,
    hueCycle: true,
    halo: "#7c4dff",
    thickness: 4,
  },
};

/** Semua key frame CSS (urutan = urutan definisi). */
export const CSS_FRAME_KEYS = Object.keys(CSS_FRAME_SPECS);

const CSS_FRAME_KEY_SET = new Set(CSS_FRAME_KEYS);

/** True bila `effect` adalah frame CSS beranimasi yang dikenal. */
export function isCssFrameEffect(effect: string): boolean {
  return CSS_FRAME_KEY_SET.has(effect);
}

/** Ambil spec dengan fallback aman ke orbit-glow. */
export function getCssFrameSpec(frame: string): CssFrameSpec {
  return CSS_FRAME_SPECS[frame] ?? CSS_FRAME_SPECS["orbit-glow"];
}
