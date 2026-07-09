/**
 * Data awal untuk editor gamifikasi (server read). Menyusun katalog kosmetik
 * dengan status owned/locked + syarat unlock, config ter-equip, dan achievement
 * user. Null bila feature flag mati.
 */
import { prisma } from "@/lib/prisma";
import { isProfileGamificationEnabled } from "./flag";
import type { AchievementView } from "./profile-view";

export type CosmeticOption = {
  id: string;
  key: string;
  name: string;
  type: string;
  rarity: string;
  previewRef: string;
  styleConfig: Record<string, unknown>;
  unlockType: string;
  unlockLevel: number | null;
  unlockAchievementKey: string | null;
  owned: boolean;
  locked: boolean;
  /** Teks syarat bila terkunci (mis. "Buka di Level 8" / "Raih 🏆 Papan Bersih"). */
  requirement: string | null;
};

export type EditorConfig = {
  equippedBackgroundId: string | null;
  equippedBorderId: string | null;
  equippedNameplateId: string | null;
  equippedTitleId: string | null;
  accentColor: string | null;
  customBackgroundUrl: string | null;
  customBackgroundMedia: string | null;
  customBorderColor: string | null;
  showcaseAchievementIds: string[];
};

/** AchievementView + id DB (dibutuhkan showcase yang menyimpan Achievement.id). */
export type EditorAchievement = AchievementView & { id: string };

export type GamificationEditorData = {
  level: number;
  config: EditorConfig;
  cosmetics: CosmeticOption[];
  achievements: EditorAchievement[];
  /** Jumlah slot showcase (bertambah seiring level). */
  showcaseSlots: number;
};

function criteriaThreshold(criteria: unknown): number {
  if (criteria && typeof criteria === "object") {
    const c = criteria as Record<string, unknown>;
    const t = Number(c.threshold ?? c.count ?? 0);
    return Number.isFinite(t) ? t : 0;
  }
  return 0;
}

/** Slot showcase = 3 dasar + 1 per 5 level (cap 6). */
export function showcaseSlotsForLevel(level: number): number {
  return Math.min(6, 3 + Math.floor(level / 5));
}

export async function getGamificationEditorData(
  userId: string,
): Promise<GamificationEditorData | null> {
  if (!(await isProfileGamificationEnabled())) return null;

  const [progression, config, cosmeticItems, owned, achievements, userAch] =
    await Promise.all([
      prisma.userProgression.findUnique({ where: { userId } }),
      prisma.userProfileConfig.findUnique({ where: { userId } }),
      prisma.cosmeticItem.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
      }),
      prisma.userCosmetic.findMany({
        where: { userId },
        select: { cosmeticItemId: true },
      }),
      prisma.achievement.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
      }),
      prisma.userAchievement.findMany({ where: { userId } }),
    ]);

  const level = progression?.level ?? 1;
  const ownedSet = new Set(owned.map((o) => o.cosmeticItemId));
  const achNameByKey = new Map(achievements.map((a) => [a.key, a.name]));
  const uaByAch = new Map(userAch.map((ua) => [ua.achievementId, ua]));
  const unlockedAchKeys = new Set(
    achievements
      .filter((a) => uaByAch.get(a.id)?.unlockedAt)
      .map((a) => a.key),
  );

  const cosmetics: CosmeticOption[] = cosmeticItems.map((c) => {
    let owned = false;
    let locked = false;
    let requirement: string | null = null;
    switch (c.unlockType) {
      case "FREE":
      case "CUSTOM_UPLOAD":
        owned = true;
        break;
      case "LEVEL":
        owned = level >= (c.unlockLevel ?? 1) || ownedSet.has(c.id);
        locked = !owned;
        if (locked) requirement = `Buka di Level ${c.unlockLevel ?? "?"}`;
        break;
      case "ACHIEVEMENT": {
        owned =
          ownedSet.has(c.id) ||
          (c.unlockAchievementKey
            ? unlockedAchKeys.has(c.unlockAchievementKey)
            : false);
        locked = !owned;
        if (locked) {
          const name = c.unlockAchievementKey
            ? achNameByKey.get(c.unlockAchievementKey) ?? c.unlockAchievementKey
            : "pencapaian";
          requirement = `Raih 🏆 ${name}`;
        }
        break;
      }
      default:
        owned = ownedSet.has(c.id);
        locked = !owned;
    }
    return {
      id: c.id,
      key: c.key,
      name: c.name,
      type: c.type,
      rarity: c.rarity,
      previewRef: c.previewRef,
      styleConfig: (c.styleConfig ?? {}) as Record<string, unknown>,
      unlockType: c.unlockType,
      unlockLevel: c.unlockLevel,
      unlockAchievementKey: c.unlockAchievementKey,
      owned,
      locked,
      requirement,
    };
  });

  const achievementViews: EditorAchievement[] = achievements.map((a) => {
    const ua = uaByAch.get(a.id);
    const unlocked = !!ua?.unlockedAt;
    const masked = a.hidden && !unlocked;
    return {
      id: a.id,
      key: a.key,
      name: masked ? "???" : a.name,
      description: masked ? "Pencapaian rahasia — belum terbuka." : a.description,
      category: a.category,
      tier: a.tier,
      icon: masked ? "Lock" : a.icon,
      unlocked,
      unlockedAt: ua?.unlockedAt ? ua.unlockedAt.toISOString() : null,
      progress: ua?.progress ?? 0,
      threshold: criteriaThreshold(a.criteria),
      hidden: a.hidden,
    };
  });

  return {
    level,
    config: {
      equippedBackgroundId: config?.equippedBackgroundId ?? null,
      equippedBorderId: config?.equippedBorderId ?? null,
      equippedNameplateId: config?.equippedNameplateId ?? null,
      equippedTitleId: config?.equippedTitleId ?? null,
      accentColor: config?.accentColor ?? null,
      customBackgroundUrl: config?.customBackgroundUrl ?? null,
      customBackgroundMedia: config?.customBackgroundMedia ?? null,
      customBorderColor: config?.customBorderColor ?? null,
      showcaseAchievementIds: Array.isArray(config?.showcaseAchievementIds)
        ? (config!.showcaseAchievementIds as string[])
        : [],
    },
    cosmetics,
    achievements: achievementViews,
    showcaseSlots: showcaseSlotsForLevel(level),
  };
}
