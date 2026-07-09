import { describe, expect, it } from "vitest";
import { canEquipCosmetic, type EquipCandidate } from "./equip-rules";

const base = (over: Partial<EquipCandidate>): EquipCandidate => ({
  id: "c1",
  type: "PROFILE_BACKGROUND",
  unlockType: "FREE",
  unlockLevel: null,
  ...over,
});

describe("canEquipCosmetic", () => {
  const opts = (over: Partial<Parameters<typeof canEquipCosmetic>[1]> = {}) => ({
    slotType: "PROFILE_BACKGROUND",
    level: 5,
    ownedIds: new Set<string>(),
    ...over,
  });

  it("rejects a type/slot mismatch", () => {
    expect(
      canEquipCosmetic(base({ type: "AVATAR_BORDER" }), opts()).ok,
    ).toBe(false);
  });

  it("allows FREE and CUSTOM_UPLOAD unconditionally", () => {
    expect(canEquipCosmetic(base({ unlockType: "FREE" }), opts()).ok).toBe(true);
    expect(
      canEquipCosmetic(base({ unlockType: "CUSTOM_UPLOAD" }), opts()).ok,
    ).toBe(true);
  });

  it("gates LEVEL items by level", () => {
    expect(
      canEquipCosmetic(base({ unlockType: "LEVEL", unlockLevel: 8 }), opts({ level: 5 })).ok,
    ).toBe(false);
    expect(
      canEquipCosmetic(base({ unlockType: "LEVEL", unlockLevel: 8 }), opts({ level: 8 })).ok,
    ).toBe(true);
  });

  it("gates ACHIEVEMENT items by ownership", () => {
    const item = base({ id: "earned1", unlockType: "ACHIEVEMENT" });
    expect(canEquipCosmetic(item, opts()).ok).toBe(false);
    expect(
      canEquipCosmetic(item, opts({ ownedIds: new Set(["earned1"]) })).ok,
    ).toBe(true);
  });

  it("allows ACHIEVEMENT items when the linked achievement is already unlocked", () => {
    const item = base({
      id: "late-reward",
      unlockType: "ACHIEVEMENT",
      unlockAchievementKey: "attendance_30",
    });
    expect(
      canEquipCosmetic(
        item,
        opts({ unlockedAchievementKeys: new Set(["attendance_30"]) }),
      ).ok,
    ).toBe(true);
  });
});
