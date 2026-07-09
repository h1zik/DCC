/**
 * Path aset kosmetik earned (kurasi tim). Dipakai seed, resolver legacy, dan
 * generator placeholder. Ganti file di `public/cosmetics/` untuk upgrade visual.
 */
export type CosmeticAssetMedia = "video" | "image" | "lottie";

export type CosmeticBgAsset = {
  src: string;
  poster: string;
  media: CosmeticAssetMedia;
};

export type CosmeticBorderAsset = {
  src: string;
  poster: string;
};

/** Background earned → file animasi + poster statis. */
export const COSMETIC_BG_ASSETS = {
  aurora: {
    src: "/cosmetics/bg-aurora.webp",
    poster: "/cosmetics/bg-aurora-poster.webp",
    media: "image",
  },
  bokeh: {
    src: "/cosmetics/bg-bokeh.webp",
    poster: "/cosmetics/bg-bokeh-poster.webp",
    media: "image",
  },
  parallax: {
    src: "/cosmetics/bg-parallax.webp",
    poster: "/cosmetics/bg-parallax-poster.webp",
    media: "image",
  },
  "shader-flux": {
    src: "/cosmetics/bg-shader-flux.webp",
    poster: "/cosmetics/bg-shader-flux-poster.webp",
    media: "image",
  },
} as const satisfies Record<string, CosmeticBgAsset>;

export const COSMETIC_BORDER_ASSETS = {
  holo: {
    src: "/cosmetics/border-holo.webp",
    poster: "/cosmetics/border-holo-poster.webp",
  },
} as const satisfies Record<string, CosmeticBorderAsset>;

/** Lookup by CosmeticItem.key (fallback bila styleConfig.src kosong di DB). */
export const COSMETIC_BG_BY_ITEM_KEY: Record<string, CosmeticBgAsset> = {
  "bg-aurora": COSMETIC_BG_ASSETS.aurora,
  "bg-bokeh": COSMETIC_BG_ASSETS.bokeh,
  "bg-parallax": COSMETIC_BG_ASSETS.parallax,
  "bg-shader-flux": COSMETIC_BG_ASSETS["shader-flux"],
};

export const COSMETIC_BORDER_BY_ITEM_KEY: Record<string, CosmeticBorderAsset> =
  {
    "border-holo": COSMETIC_BORDER_ASSETS.holo,
  };

/** Pemetaan efek procedural lama (DB existing) → aset kurasi. */
export const LEGACY_BG_EFFECT_TO_ASSET: Record<
  string,
  keyof typeof COSMETIC_BG_ASSETS
> = {
  "aurora-webgl": "aurora",
  "bokeh-webgl": "bokeh",
  parallax: "parallax",
  "shader-flux": "shader-flux",
};
