import { describe, expect, it } from "vitest";
import {
  backgroundNeedsWebgl,
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

  it("resolves an earned WebGL background (palette=theme, animated)", () => {
    const cfg = {
      equippedBackgroundId: "bg1",
      equippedBorderId: null,
      equippedNameplateId: null,
      equippedTitleId: null,
      accentColor: null,
      customBackgroundUrl: null,
      customBorderColor: null,
    };
    const item: CosmeticLite = {
      key: "bg-aurora",
      type: "PROFILE_BACKGROUND",
      previewRef: "aurora",
      styleConfig: { effect: "aurora-webgl", palette: "theme", intensity: 2 },
    };
    const r = resolveProfileCosmetics(build(cfg, [["bg1", item]]));
    expect(r.background).toMatchObject({ effect: "aurora-webgl", palette: "theme" });
    expect(backgroundNeedsWebgl(r.background)).toBe(true);
    expect(r.animated).toBe(true);
  });

  it("uses the uploaded image url for a custom-upload background", () => {
    const cfg = {
      equippedBackgroundId: "up1",
      equippedBorderId: null,
      equippedNameplateId: null,
      equippedTitleId: null,
      accentColor: null,
      customBackgroundUrl: "/uploads/profile-bg/u/x.webp",
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
    expect(backgroundNeedsWebgl(r.background)).toBe(false);
  });

  it("applies a custom border color and config accent override", () => {
    const cfg = {
      equippedBackgroundId: null,
      equippedBorderId: "bc1",
      equippedNameplateId: null,
      equippedTitleId: null,
      accentColor: "#00ccaa",
      customBackgroundUrl: null,
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
});
