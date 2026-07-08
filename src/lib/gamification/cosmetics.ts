/**
 * Resolusi kosmetik yang di-equip → deskriptor render (murni, testable).
 * Prinsip fallback: kosmetik yang di-equip menang; bila kosong, jatuh ke
 * kolom `User.profile*` LAMA supaya menyalakan flag tak mengubah tampilan
 * sampai user meng-equip sesuatu. `styleConfig` earned mereferensi preset
 * animasi terkurasi — warnanya diambil dari TOKEN TEMA (palette:"theme").
 */

export type BackgroundDescriptor =
  | { effect: "gradient"; preset: string }
  | { effect: "image"; url: string }
  | {
      effect: string; // aurora-webgl | bokeh-webgl | parallax | shader-flux | …
      palette: "theme";
      params: Record<string, number>;
    };

export type BorderDescriptor =
  | { effect: "static-frame"; variant: string }
  | { effect: "static-frame"; color: string }
  | { effect: string }; // orbit-glow | foil | holographic | …

export type ResolvedCosmetics = {
  background: BackgroundDescriptor;
  border: BorderDescriptor;
  nameplate: { effect: string } | null;
  title: string | null;
  accentColor: string | null;
  /** True bila ada minimal satu kosmetik BERANIMASI ter-equip (untuk gating). */
  animated: boolean;
};

type StyleConfig = Record<string, unknown>;

/** Item kosmetik minimal yang dibutuhkan resolver. */
export type CosmeticLite = {
  key: string;
  type: string;
  previewRef: string;
  styleConfig: StyleConfig;
};

export type EquipInput = {
  /** UserProfileConfig; null bila belum ada. */
  config: {
    equippedBackgroundId: string | null;
    equippedBorderId: string | null;
    equippedNameplateId: string | null;
    equippedTitleId: string | null;
    accentColor: string | null;
    customBackgroundUrl: string | null;
    customBorderColor: string | null;
  } | null;
  /** Map id → CosmeticItem untuk id yang ter-equip. */
  itemsById: Map<string, CosmeticLite>;
  /** Kolom appearance lama (fallback). */
  legacy: {
    bannerPreset: string;
    avatarFrame: string;
    accentHex: string | null;
  };
};

const STATIC_BG_EFFECTS = new Set(["gradient", "image"]);
const STATIC_BORDER_EFFECTS = new Set(["static-frame"]);

function num(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function resolveBackground(input: EquipInput): {
  descriptor: BackgroundDescriptor;
  animated: boolean;
} {
  const item = input.config?.equippedBackgroundId
    ? input.itemsById.get(input.config.equippedBackgroundId)
    : undefined;

  if (item) {
    const effect = String(item.styleConfig.effect ?? "gradient");
    if (effect === "gradient") {
      return {
        descriptor: {
          effect: "gradient",
          preset: String(item.styleConfig.preset ?? item.previewRef),
        },
        animated: false,
      };
    }
    if (effect === "image") {
      // Custom upload: URL ada di config, bukan styleConfig.
      const url = input.config?.customBackgroundUrl ?? "";
      if (url) return { descriptor: { effect: "image", url }, animated: false };
      // Slot upload tapi belum ada file → fallback gradient legacy.
    } else {
      // Earned animated effect.
      const params: Record<string, number> = {};
      for (const [k, v] of Object.entries(item.styleConfig)) {
        if (typeof v === "number") params[k] = v;
      }
      return {
        descriptor: { effect, palette: "theme", params },
        animated: true,
      };
    }
  }

  // Fallback: preset gradien lama.
  return {
    descriptor: { effect: "gradient", preset: input.legacy.bannerPreset },
    animated: false,
  };
}

function resolveBorder(input: EquipInput): {
  descriptor: BorderDescriptor;
  animated: boolean;
} {
  const item = input.config?.equippedBorderId
    ? input.itemsById.get(input.config.equippedBorderId)
    : undefined;

  if (item) {
    const effect = String(item.styleConfig.effect ?? "static-frame");
    if (effect === "static-frame") {
      // Warna kustom (bila di-set) atau varian preset.
      if (input.config?.customBorderColor && item.styleConfig.color === "user-hex") {
        return {
          descriptor: { effect: "static-frame", color: input.config.customBorderColor },
          animated: false,
        };
      }
      return {
        descriptor: {
          effect: "static-frame",
          variant: String(item.styleConfig.variant ?? item.previewRef),
        },
        animated: false,
      };
    }
    return { descriptor: { effect }, animated: true };
  }

  // Fallback: frame avatar lama.
  return {
    descriptor: { effect: "static-frame", variant: input.legacy.avatarFrame },
    animated: false,
  };
}

/** Resolusi lengkap → deskriptor render + flag animasi. Murni. */
export function resolveProfileCosmetics(input: EquipInput): ResolvedCosmetics {
  const bg = resolveBackground(input);
  const border = resolveBorder(input);

  const nameplateItem = input.config?.equippedNameplateId
    ? input.itemsById.get(input.config.equippedNameplateId)
    : undefined;
  const nameplate = nameplateItem
    ? { effect: String(nameplateItem.styleConfig.effect ?? "glass") }
    : null;
  const nameplateAnimated = !!nameplate;

  const titleItem = input.config?.equippedTitleId
    ? input.itemsById.get(input.config.equippedTitleId)
    : undefined;
  const title = titleItem
    ? String(titleItem.styleConfig.text ?? titleItem.styleConfig.source ?? "")
    : null;

  const accentColor =
    input.config?.accentColor?.trim() || input.legacy.accentHex || null;

  return {
    background: bg.descriptor,
    border: border.descriptor,
    nameplate,
    title: title || null,
    accentColor,
    animated: bg.animated || border.animated || nameplateAnimated,
  };
}

/** True bila deskripsi background butuh engine WebGL (bukan statis). */
export function backgroundNeedsWebgl(bg: BackgroundDescriptor): boolean {
  return !STATIC_BG_EFFECTS.has(bg.effect);
}

/** True bila deskripsi border butuh animasi (bukan static-frame). */
export function borderIsAnimated(border: BorderDescriptor): boolean {
  return !STATIC_BORDER_EFFECTS.has(border.effect);
}

/** Intensitas efek (default 1) — dipakai shader/particle cap. */
export function effectIntensity(bg: BackgroundDescriptor): number {
  if ("params" in bg) return num(bg.params.intensity, 1);
  return 1;
}
