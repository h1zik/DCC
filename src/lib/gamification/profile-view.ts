/**
 * Model tampilan gamifikasi untuk halaman profil (server read; dipanggil server
 * component seperti `getProfileShowcaseData`). Merangkai progression, achievement,
 * dan kosmetik ter-equip (dengan fallback ke appearance lama). Return null bila
 * feature flag mati → halaman render seperti semula.
 */
import { prisma } from "@/lib/prisma";
import {
  isProfileBannerPreset,
  isProfileAvatarFrame,
} from "@/lib/profile-appearance";
import {
  resolveProfileCosmetics,
  type CosmeticLite,
  type ResolvedCosmetics,
} from "./cosmetics";
import { isProfileGamificationEnabled } from "./flag";
import { cumXp, levelProgress } from "./level";
import { bridgesOnlyWeekend } from "./streak";
import { jakartaDateString } from "./time";

export type AchievementView = {
  key: string;
  name: string;
  description: string;
  category: string;
  tier: string;
  icon: string;
  symbolSrc: string | null;
  symbolMedia: "image" | "video" | "lottie" | "file" | null;
  symbolPoster: string | null;
  symbolFileName: string | null;
  unlocked: boolean;
  unlockedAt: string | null;
  progress: number;
  threshold: number;
  hidden: boolean;
};

export type GamificationView = {
  level: number;
  xpTotal: number;
  levelInto: number;
  levelSpan: number;
  levelRatio: number;
  nextLevelXp: number;
  attendanceStreak: number;
  longestAttendanceStreak: number;
  streakAlive: boolean;
  cosmetics: ResolvedCosmetics;
  achievements: AchievementView[];
  showcase: AchievementView[];
  unlockedCount: number;
  totalCount: number;
  /** True bila ada achievement baru terbuka (≤2 menit) → putar celebration sekali. */
  celebrate: boolean;
};

function criteriaThreshold(criteria: unknown): number {
  if (criteria && typeof criteria === "object") {
    const c = criteria as Record<string, unknown>;
    const t = Number(c.threshold ?? c.count ?? 0);
    return Number.isFinite(t) ? t : 0;
  }
  return 0;
}

/** Level fallback dari tenure (level keanggotaan lama) bila progression belum ada. */
function tenureLevel(createdAt: Date): number {
  const days = Math.max(0, Math.floor((Date.now() - createdAt.getTime()) / 86_400_000));
  return Math.max(1, Math.floor(days / 30) + 1);
}

export async function getProfileGamificationView(
  userId: string,
): Promise<GamificationView | null> {
  if (!(await isProfileGamificationEnabled())) return null;

  const [user, progression, config, achievements, userAchievements] =
    await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          createdAt: true,
          profileBannerPreset: true,
          profileAvatarFrame: true,
          profileAccentHex: true,
        },
      }),
      prisma.userProgression.findUnique({ where: { userId } }),
      prisma.userProfileConfig.findUnique({ where: { userId } }),
      prisma.achievement.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
      }),
      prisma.userAchievement.findMany({ where: { userId } }),
    ]);
  if (!user) return null;

  // Equipped cosmetics → fetch item styleConfig.
  const equippedIds = [
    config?.equippedBackgroundId,
    config?.equippedBorderId,
    config?.equippedNameplateId,
    config?.equippedTitleId,
  ].filter((id): id is string => Boolean(id));

  const itemsById = new Map<string, CosmeticLite>();
  if (equippedIds.length > 0) {
    const items = await prisma.cosmeticItem.findMany({
      where: { id: { in: equippedIds } },
      select: { id: true, key: true, type: true, previewRef: true, styleConfig: true },
    });
    for (const it of items) {
      itemsById.set(it.id, {
        key: it.key,
        type: it.type,
        previewRef: it.previewRef,
        styleConfig: (it.styleConfig ?? {}) as Record<string, unknown>,
      });
    }
  }

  const cosmetics = resolveProfileCosmetics({
    config: config
      ? {
          equippedBackgroundId: config.equippedBackgroundId,
          equippedBorderId: config.equippedBorderId,
          equippedNameplateId: config.equippedNameplateId,
          equippedTitleId: config.equippedTitleId,
          accentColor: config.accentColor,
          customBorderColor: config.customBorderColor,
        }
      : null,
    itemsById,
    legacy: {
      bannerPreset: isProfileBannerPreset(user.profileBannerPreset)
        ? user.profileBannerPreset
        : "twilight",
      avatarFrame: isProfileAvatarFrame(user.profileAvatarFrame)
        ? user.profileAvatarFrame
        : "ring",
      accentHex: user.profileAccentHex,
    },
  });

  // Progression (fallback ke level tenure bila belum di-backfill).
  const fallbackLevel = tenureLevel(user.createdAt);
  const xpTotal = progression?.xpTotal ?? cumXp(fallbackLevel);
  const level = Math.max(progression?.level ?? 1, fallbackLevel);
  const lp = levelProgress(xpTotal);

  // Streak masih hidup? (hari ini, atau tak ada hari kerja terlewat sejak check-in terakhir)
  const today = jakartaDateString(new Date());
  const lastCheckin = progression?.lastCheckinDate ?? null;
  const streakAlive =
    !!lastCheckin &&
    (lastCheckin === today || bridgesOnlyWeekend(lastCheckin, today));

  // Achievement views (mask hidden yang belum terbuka).
  const uaByAch = new Map(userAchievements.map((ua) => [ua.achievementId, ua]));
  const views: AchievementView[] = achievements.map((a) => {
    const ua = uaByAch.get(a.id);
    const unlocked = !!ua?.unlockedAt;
    const masked = a.hidden && !unlocked;
    return {
      key: a.key,
      name: masked ? "???" : a.name,
      description: masked ? "Pencapaian rahasia — belum terbuka." : a.description,
      category: a.category,
      tier: a.tier,
      icon: masked ? "Lock" : a.icon,
      symbolSrc: masked ? null : a.symbolSrc,
      symbolMedia:
        !masked &&
        (a.symbolMedia === "image" ||
          a.symbolMedia === "video" ||
          a.symbolMedia === "lottie" ||
          a.symbolMedia === "file")
          ? a.symbolMedia
          : null,
      symbolPoster: masked ? null : a.symbolPoster,
      symbolFileName: masked ? null : a.symbolFileName,
      unlocked,
      unlockedAt: ua?.unlockedAt ? ua.unlockedAt.toISOString() : null,
      progress: ua?.progress ?? 0,
      threshold: criteriaThreshold(a.criteria),
      hidden: a.hidden,
    };
  });
  const viewByKey = new Map(views.map((v) => [v.key, v]));
  const achByIdKey = new Map(achievements.map((a) => [a.id, a.key]));

  // Showcase: pakai urutan showcaseAchievementIds (unlocked saja), else top unlocked.
  const showcaseIds = Array.isArray(config?.showcaseAchievementIds)
    ? (config!.showcaseAchievementIds as string[])
    : [];
  let showcase: AchievementView[] = showcaseIds
    .map((id) => viewByKey.get(achByIdKey.get(id) ?? ""))
    .filter((v): v is AchievementView => !!v && v.unlocked);
  if (showcase.length === 0) {
    showcase = views.filter((v) => v.unlocked).slice(0, 6);
  }

  return {
    level,
    xpTotal,
    levelInto: lp.into,
    levelSpan: lp.span,
    levelRatio: lp.ratio,
    nextLevelXp: lp.nextLevelXp,
    attendanceStreak: progression?.attendanceStreak ?? 0,
    longestAttendanceStreak: progression?.longestAttendanceStreak ?? 0,
    streakAlive,
    cosmetics,
    achievements: views,
    showcase,
    unlockedCount: views.filter((v) => v.unlocked).length,
    totalCount: views.length,
    celebrate: views.some(
      (v) => v.unlockedAt && Date.now() - Date.parse(v.unlockedAt) < 120_000,
    ),
  };
}
