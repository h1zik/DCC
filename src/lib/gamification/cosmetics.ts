/**
 * Resolusi kosmetik yang di-equip → deskriptor render (murni, testable).
 * Prinsip fallback: kosmetik yang di-equip menang; bila kosong, jatuh ke
 * kolom `User.profile*` LAMA supaya menyalakan flag tak mengubah tampilan
 * sampai user meng-equip sesuatu.
 *
 * Earned animasi premium → `asset-loop` / `asset-frame` (WebM/WebP/APNG kurasi).
 * Earned sederhana (orbit/foil) → CSS transform. Warna FREE ikut token tema.
 */

import {
  COSMETIC_BG_ASSETS,
  COSMETIC_BG_BY_ITEM_KEY,
  COSMETIC_BORDER_ASSETS,
  COSMETIC_BORDER_BY_ITEM_KEY,
  LEGACY_BG_EFFECT_TO_ASSET,
  type CosmeticAssetMedia,
} from "./cosmetic-assets";
import { inferCustomBackgroundMedia } from "./custom-background-upload";
import { isCssFrameEffect } from "./frame-styles";

export type BackgroundDescriptor =
  | { effect: "gradient"; preset: string }
  | { effect: "image"; url: string; focalPoint?: string }
  | {
      effect: "asset-loop";
      src: string;
      poster?: string;
      media: CosmeticAssetMedia;
      /** `object-position` (mis. "50% 20%") — bagian aset yang tampil saat di-crop. */
      focalPoint?: string;
      /** Skala zoom (1 = fit dasar). >1 zoom in, <1 zoom out (bar terisi tema). */
      zoom?: number;
      /** "cover" (penuhi bingkai, bisa terpotong) / "contain" (utuh, ada bar). */
      fit?: "cover" | "contain";
    };

export type BorderDescriptor =
  | { effect: "static-frame"; variant: string }
  | { effect: "static-frame"; color: string }
  /** Frame CSS beranimasi; `frame` = key di CSS_FRAME_SPECS (orbit-glow/foil/…). */
  | { effect: "css-frame"; frame: string }
  | { effect: "asset-frame"; src: string; poster?: string; scale?: number };

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
    customBackgroundMedia: string | null;
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

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function resolveAssetLoop(
  cfg: StyleConfig,
  itemKey?: string,
): BackgroundDescriptor {
  let src = str(cfg.src);
  let poster = str(cfg.poster) || undefined;
  let media: CosmeticAssetMedia =
    cfg.media === "video"
      ? "video"
      : cfg.media === "lottie"
        ? "lottie"
        : "image";
  const focalPoint = str(cfg.focalPoint) || undefined;
  const zoomRaw = typeof cfg.zoom === "number" ? cfg.zoom : Number(cfg.zoom);
  const zoom = Number.isFinite(zoomRaw) && zoomRaw > 0 ? zoomRaw : undefined;
  const fit = cfg.fit === "contain" ? "contain" : undefined;

  if (!src && itemKey) {
    const fallback = COSMETIC_BG_BY_ITEM_KEY[itemKey];
    if (fallback) {
      src = fallback.src;
      poster = poster ?? fallback.poster;
      media = fallback.media;
    }
  }

  return { effect: "asset-loop", src, poster, media, focalPoint, zoom, fit };
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
      const url = input.config?.customBackgroundUrl ?? "";
      if (url) {
        const media = inferCustomBackgroundMedia(
          url,
          input.config?.customBackgroundMedia,
        );
        if (media === "lottie" || media === "video") {
          return {
            descriptor: { effect: "asset-loop", src: url, media },
            animated: true,
          };
        }
        return { descriptor: { effect: "image", url }, animated: false };
      }
    } else if (effect === "asset-loop") {
      return {
        descriptor: resolveAssetLoop(item.styleConfig, item.key),
        animated: true,
      };
    } else {
      const legacyKey = LEGACY_BG_EFFECT_TO_ASSET[effect];
      if (legacyKey) {
        const asset = COSMETIC_BG_ASSETS[legacyKey];
        return {
          descriptor: {
            effect: "asset-loop",
            src: asset.src,
            poster: asset.poster,
            media: asset.media,
          },
          animated: true,
        };
      }
    }
  }

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
    if (effect === "asset-frame") {
      let src = str(item.styleConfig.src);
      let poster = str(item.styleConfig.poster) || undefined;
      const scaleRaw =
        typeof item.styleConfig.scale === "number"
          ? item.styleConfig.scale
          : Number(item.styleConfig.scale);
      const scale = Number.isFinite(scaleRaw) && scaleRaw > 0 ? scaleRaw : undefined;
      if (!src) {
        const fallback = COSMETIC_BORDER_BY_ITEM_KEY[item.key];
        if (fallback) {
          src = fallback.src;
          poster = poster ?? fallback.poster;
        }
      }
      return {
        descriptor: { effect: "asset-frame", src, poster, scale },
        animated: true,
      };
    }
    if (effect === "holographic") {
      const asset = COSMETIC_BORDER_ASSETS.holo;
      return {
        descriptor: {
          effect: "asset-frame",
          src: asset.src,
          poster: asset.poster,
        },
        animated: true,
      };
    }
    if (isCssFrameEffect(effect)) {
      return {
        descriptor: { effect: "css-frame", frame: effect },
        animated: true,
      };
    }
  }

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

/** True bila background earned butuh lapisan animasi (bukan statis). */
export function backgroundIsAnimated(bg: BackgroundDescriptor): boolean {
  return !STATIC_BG_EFFECTS.has(bg.effect);
}

/** @deprecated Pakai `backgroundIsAnimated`. */
export function backgroundNeedsWebgl(bg: BackgroundDescriptor): boolean {
  return backgroundIsAnimated(bg);
}

/** True bila deskripsi border butuh animasi (bukan static-frame). */
export function borderIsAnimated(border: BorderDescriptor): boolean {
  return !STATIC_BORDER_EFFECTS.has(border.effect);
}
