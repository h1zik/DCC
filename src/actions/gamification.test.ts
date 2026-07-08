import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    userProgression: { findUnique: vi.fn() },
    userCosmetic: { findMany: vi.fn() },
    cosmeticItem: { findMany: vi.fn() },
    userAchievement: { findMany: vi.fn() },
    userProfileConfig: { upsert: vi.fn() },
  },
  authUserId: { value: "u1" as string | null },
}));
vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () =>
    mocks.authUserId.value ? { user: { id: mocks.authUserId.value } } : null,
  ),
}));
vi.mock("@/lib/gamification", () => ({
  isProfileGamificationEnabled: () => true,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("sharp", () => ({ default: vi.fn() }));

import { updateProfileConfig } from "./gamification";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.authUserId.value = "u1";
  mocks.prisma.userProgression.findUnique.mockResolvedValue({ level: 5 });
  mocks.prisma.userCosmetic.findMany.mockResolvedValue([]);
  mocks.prisma.cosmeticItem.findMany.mockResolvedValue([]);
  mocks.prisma.userAchievement.findMany.mockResolvedValue([]);
  mocks.prisma.userProfileConfig.upsert.mockResolvedValue({});
});

describe("updateProfileConfig authorization", () => {
  it("equips a FREE cosmetic the user is allowed to use", async () => {
    mocks.prisma.cosmeticItem.findMany.mockResolvedValue([
      { id: "bg-free", type: "PROFILE_BACKGROUND", unlockType: "FREE", unlockLevel: null },
    ]);
    await updateProfileConfig({ equippedBackgroundId: "bg-free" });
    expect(mocks.prisma.userProfileConfig.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ equippedBackgroundId: "bg-free" }),
      }),
    );
  });

  it("REJECTS equipping an ACHIEVEMENT item the user does not own", async () => {
    mocks.prisma.cosmeticItem.findMany.mockResolvedValue([
      { id: "bg-earned", type: "PROFILE_BACKGROUND", unlockType: "ACHIEVEMENT", unlockLevel: null },
    ]);
    // ownedIds empty → not owned
    await expect(
      updateProfileConfig({ equippedBackgroundId: "bg-earned" }),
    ).rejects.toThrow(/belum kamu miliki/i);
    expect(mocks.prisma.userProfileConfig.upsert).not.toHaveBeenCalled();
  });

  it("REJECTS a LEVEL item above the user's level", async () => {
    mocks.prisma.cosmeticItem.findMany.mockResolvedValue([
      { id: "bg-lvl15", type: "PROFILE_BACKGROUND", unlockType: "LEVEL", unlockLevel: 15 },
    ]);
    await expect(
      updateProfileConfig({ equippedBackgroundId: "bg-lvl15" }),
    ).rejects.toThrow(/Level 15/);
  });

  it("REJECTS a type/slot mismatch", async () => {
    mocks.prisma.cosmeticItem.findMany.mockResolvedValue([
      { id: "border1", type: "AVATAR_BORDER", unlockType: "FREE", unlockLevel: null },
    ]);
    await expect(
      updateProfileConfig({ equippedBackgroundId: "border1" }),
    ).rejects.toThrow(/tidak cocok/i);
  });

  it("REJECTS showcase achievements the user has not unlocked", async () => {
    mocks.prisma.userAchievement.findMany.mockResolvedValue([]); // none unlocked
    await expect(
      updateProfileConfig({ showcaseAchievementIds: ["a1", "a2"] }),
    ).rejects.toThrow(/belum kamu buka/i);
  });

  it("allows unequipping (null) without ownership checks", async () => {
    await updateProfileConfig({ equippedBackgroundId: null });
    expect(mocks.prisma.userProfileConfig.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ equippedBackgroundId: null }),
      }),
    );
  });

  it("throws when not authenticated", async () => {
    mocks.authUserId.value = null;
    await expect(updateProfileConfig({})).rejects.toThrow(/Belum masuk/i);
  });
});
