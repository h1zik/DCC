import { describe, expect, it } from "vitest";
import { COSMETIC_BG_ASSETS } from "./cosmetic-assets";
import { CSS_FRAME_KEYS } from "./frame-styles";
import {
  backgroundIsAnimated,
  borderIsAnimated,
  resolveProfileCosmetics,
  type CosmeticLite,
  type EquipInput,
} from "./cosmetics";

const legacy = { bannerPreset: "ocean", avatarFrame: "gem", accentHex: "#ff8800" };

function build(
  config: EquipInput["config"],
  items: Array<[string, CosmeticLite]> = [],
): EquipInput {
  return { config, itemsById: new Map(items), legacy };
}

describe("resolveProfileCosmetics", () => {
  it("falls back to legacy appearance when nothing is equipped", () => {
    const r = resolveProfileCosmetics(build(null));
    expect(r.background).toEqual({ effect: "gradient", preset: "ocean" });
    expect(r.border).toEqual({ effect: "static-frame", variant: "gem" });
    expect(r.accentColor).toBe("#ff8800");
    expect(r.animated).toBe(false);
  });

  it("resolves an earned asset-loop background", () => {
    const cfg = {
      equippedBackgroundId: "bg1",
      equippedBorderId: null,
      equippedNameplateId: null,
      equippedTitleId: null,
      accentColor: null,
      customBackgroundUrl: null,
      customBackgroundMedia: null,
      customBorderColor: null,
    };
    const aurora = COSMETIC_BG_ASSETS.aurora;
    const item: CosmeticLite = {
      key: "bg-aurora",
      type: "PROFILE_BACKGROUND",
      previewRef: "aurora",
      styleConfig: {
        effect: "asset-loop",
        src: aurora.src,
        poster: aurora.poster,
        media: aurora.media,
      },
    };
    const r = resolveProfileCosmetics(build(cfg, [["bg1", item]]));
    expect(r.background).toMatchObject({
      effect: "asset-loop",
      src: aurora.src,
      media: "image",
    });
    expect(backgroundIsAnimated(r.background)).toBe(true);
    expect(r.animated).toBe(true);
  });

  it("resolves asset-loop with lottie media", () => {
    const cfg = {
      equippedBackgroundId: "bg1",
      equippedBorderId: null,
      equippedNameplateId: null,
      equippedTitleId: null,
      accentColor: null,
      customBackgroundUrl: null,
      customBackgroundMedia: null,
      customBorderColor: null,
    };
    const item: CosmeticLite = {
      key: "bg-aurora",
      type: "PROFILE_BACKGROUND",
      previewRef: "aurora",
      styleConfig: {
        effect: "asset-loop",
        src: "/cosmetics/bg-aurora.lottie",
        poster: "/cosmetics/bg-aurora-poster.webp",
        media: "lottie",
      },
    };
    const r = resolveProfileCosmetics(build(cfg, [["bg1", item]]));
    expect(r.background).toMatchObject({
      effect: "asset-loop",
      media: "lottie",
      src: "/cosmetics/bg-aurora.lottie",
    });
  });

  it("maps legacy aurora-webgl effect to asset-loop (DB backward compat)", () => {
    const cfg = {
      equippedBackgroundId: "bg1",
      equippedBorderId: null,
      equippedNameplateId: null,
      equippedTitleId: null,
      accentColor: null,
      customBackgroundUrl: null,
      customBackgroundMedia: null,
      customBorderColor: null,
    };
    const item: CosmeticLite = {
      key: "bg-aurora",
      type: "PROFILE_BACKGROUND",
      previewRef: "aurora",
      styleConfig: { effect: "aurora-webgl", palette: "theme", intensity: 2 },
    };
    const r = resolveProfileCosmetics(build(cfg, [["bg1", item]]));
    expect(r.background).toMatchObject({
      effect: "asset-loop",
      src: COSMETIC_BG_ASSETS.aurora.src,
    });
  });

  it("uses the uploaded image url for a custom-upload background", () => {
    const cfg = {
      equippedBackgroundId: "up1",
      equippedBorderId: null,
      equippedNameplateId: null,
      equippedTitleId: null,
      accentColor: null,
      customBackgroundUrl: "/uploads/profile-bg/u/x.webp",
      customBackgroundMedia: "image",
      customBorderColor: null,
    };
    const item: CosmeticLite = {
      key: "bg-upload-slot",
      type: "PROFILE_BACKGROUND",
      previewRef: "upload",
      styleConfig: { effect: "image", src: "user-upload" },
    };
    const r = resolveProfileCosmetics(build(cfg, [["up1", item]]));
    expect(r.background).toEqual({ effect: "image", url: "/uploads/profile-bg/u/x.webp" });
    expect(backgroundIsAnimated(r.background)).toBe(false);
  });

  it("uses uploaded lottie as animated asset-loop", () => {
    const cfg = {
      equippedBackgroundId: "up1",
      equippedBorderId: null,
      equippedNameplateId: null,
      equippedTitleId: null,
      accentColor: null,
      customBackgroundUrl: "/uploads/profile-bg/u/anim.json",
      customBackgroundMedia: "lottie",
      customBorderColor: null,
    };
    const item: CosmeticLite = {
      key: "bg-upload-slot",
      type: "PROFILE_BACKGROUND",
      previewRef: "upload",
      styleConfig: { effect: "image", src: "user-upload" },
    };
    const r = resolveProfileCosmetics(build(cfg, [["up1", item]]));
    expect(r.background).toEqual({
      effect: "asset-loop",
      src: "/uploads/profile-bg/u/anim.json",
      media: "lottie",
    });
    expect(r.animated).toBe(true);
  });

  it("uses uploaded mp4 as animated video asset-loop", () => {
    const cfg = {
      equippedBackgroundId: "up1",
      equippedBorderId: null,
      equippedNameplateId: null,
      equippedTitleId: null,
      accentColor: null,
      customBackgroundUrl: "/uploads/profile-bg/u/loop.mp4",
      customBackgroundMedia: "video",
      customBorderColor: null,
    };
    const item: CosmeticLite = {
      key: "bg-upload-slot",
      type: "PROFILE_BACKGROUND",
      previewRef: "upload",
      styleConfig: { effect: "image", src: "user-upload" },
    };
    const r = resolveProfileCosmetics(build(cfg, [["up1", item]]));
    expect(r.background).toEqual({
      effect: "asset-loop",
      src: "/uploads/profile-bg/u/loop.mp4",
      media: "video",
    });
    expect(r.animated).toBe(true);
  });

  it("applies a custom border color and config accent override", () => {
    const cfg = {
      equippedBackgroundId: null,
      equippedBorderId: "bc1",
      equippedNameplateId: null,
      equippedTitleId: null,
      accentColor: "#00ccaa",
      customBackgroundUrl: null,
      customBackgroundMedia: null,
      customBorderColor: "#123456",
    };
    const item: CosmeticLite = {
      key: "border-color-custom",
      type: "AVATAR_BORDER",
      previewRef: "border-color",
      styleConfig: { effect: "static-frame", color: "user-hex" },
    };
    const r = resolveProfileCosmetics(build(cfg, [["bc1", item]]));
    expect(r.border).toEqual({ effect: "static-frame", color: "#123456" });
    expect(borderIsAnimated(r.border)).toBe(false);
    expect(r.accentColor).toBe("#00ccaa");
  });

  it("resolves CSS animated avatar borders", () => {
    const baseCfg = {
      equippedBackgroundId: null,
      equippedNameplateId: null,
      equippedTitleId: null,
      accentColor: null,
      customBackgroundUrl: null,
      customBackgroundMedia: null,
      customBorderColor: null,
    };

    // Semua key frame CSS di katalog harus resolve ke deskriptor css-frame.
    expect(CSS_FRAME_KEYS).toContain("orbit-glow");
    expect(CSS_FRAME_KEYS).toContain("foil");

    for (const effect of CSS_FRAME_KEYS) {
      const r = resolveProfileCosmetics(
        build(
          { ...baseCfg, equippedBorderId: effect },
          [
            [
              effect,
              {
                key: `border-${effect}`,
                type: "AVATAR_BORDER",
                previewRef: effect,
                styleConfig: { effect },
              },
            ],
          ],
        ),
      );
      expect(r.border).toEqual({ effect: "css-frame", frame: effect });
      expect(borderIsAnimated(r.border)).toBe(true);
      expect(r.animated).toBe(true);
    }
  });
});
