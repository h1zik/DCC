/**
 * Engine achievement: evaluasi criteria (data-driven) + unlock idempotent
 * (set unlockedAt sekali → grant XP bonus + cosmetic + notifikasi).
 *
 * `evaluateCriteria` murni (di-pin test). `evaluateAchievements` mengumpulkan
 * fakta read-only lalu meng-upsert progress & meng-unlock yang tercapai.
 */
import { NotificationType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notifyUser } from "@/lib/notify";
import { isProfileGamificationEnabled } from "./flag";
import { grantXp } from "./grant";
import { jakartaHour } from "./time";

const DAY_MS = 86_400_000;

export type AchievementFacts = {
  /** Streak terpanjang yang pernah dicapai (achievement "beruntun N" tetap terkunci sekali dicapai). */
  longestStreak: number;
  currentStreak: number;
  level: number;
  taskOntimeCount: number;
  tenureDays: number;
  /** hour → jumlah check-in terverifikasi dengan jam lokal < hour. */
  checkinBeforeHour: Record<number, number>;
};

type Criteria = { type?: unknown; [k: string]: unknown };

function num(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export type CriteriaResult = {
  progress: number;
  threshold: number;
  satisfied: boolean;
  /** True bila type criteria belum dievaluasi engine (butuh histori/snapshot). */
  unsupported?: boolean;
};

/** Evaluasi satu criteria terhadap fakta user (murni). */
export function evaluateCriteria(
  criteria: Criteria,
  facts: AchievementFacts,
): CriteriaResult {
  const type = String(criteria.type ?? "");
  switch (type) {
    case "attendance_streak": {
      const threshold = num(criteria.threshold);
      return {
        progress: facts.longestStreak,
        threshold,
        satisfied: facts.longestStreak >= threshold,
      };
    }
    case "task_ontime_count": {
      const threshold = num(criteria.threshold);
      return {
        progress: facts.taskOntimeCount,
        threshold,
        satisfied: facts.taskOntimeCount >= threshold,
      };
    }
    case "tenure_days": {
      const threshold = num(criteria.threshold);
      return {
        progress: facts.tenureDays,
        threshold,
        satisfied: facts.tenureDays >= threshold,
      };
    }
    case "level_reached": {
      const threshold = num(criteria.threshold);
      return {
        progress: facts.level,
        threshold,
        satisfied: facts.level >= threshold,
      };
    }
    case "checkin_before_hour": {
      const threshold = num(criteria.count);
      const hour = num(criteria.hour);
      const progress = facts.checkinBeforeHour[hour] ?? 0;
      return { progress, threshold, satisfied: progress >= threshold };
    }
    default:
      // zero_overdue_days / overdue_recovered / fresh_modules_weeks /
      // streak_rebuilt: butuh histori/snapshot khusus — belum dievaluasi di FASE 3.
      return {
        progress: 0,
        threshold: num(criteria.threshold),
        satisfied: false,
        unsupported: true,
      };
  }
}

/** Kumpulkan fakta read-only untuk evaluasi achievement seorang user. */
export async function gatherAchievementFacts(
  userId: string,
): Promise<AchievementFacts> {
  const [prog, user, taskOntimeCount, checkins] = await Promise.all([
    prisma.userProgression.findUnique({ where: { userId } }),
    prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true } }),
    prisma.xpLedger.count({ where: { userId, reason: "TASK_ONTIME" } }),
    prisma.attendance.findMany({
      where: { userId, type: "CHECK_IN", confidence: { gt: 0 } },
      select: { timestamp: true },
    }),
  ]);

  const localHours = checkins.map((c) => jakartaHour(c.timestamp));
  const checkinBeforeHour: Record<number, number> = {};
  for (let hour = 1; hour <= 23; hour++) {
    checkinBeforeHour[hour] = localHours.filter((h) => h < hour).length;
  }

  const tenureDays = user
    ? Math.max(0, Math.floor((Date.now() - user.createdAt.getTime()) / DAY_MS))
    : 0;

  return {
    longestStreak: prog?.longestAttendanceStreak ?? 0,
    currentStreak: prog?.attendanceStreak ?? 0,
    level: prog?.level ?? 1,
    taskOntimeCount,
    tenureDays,
    checkinBeforeHour,
  };
}

/**
 * Evaluasi & unlock achievement untuk seorang user. Idempotent: progress selalu
 * di-upsert; unlock + grant XP + cosmetic + notifikasi hanya sekali per achievement.
 * `notify:false` untuk backfill historis (tak spam notifikasi).
 */
export async function evaluateAchievements(
  userId: string,
  opts: { notify?: boolean } = {},
): Promise<string[]> {
  if (!(await isProfileGamificationEnabled())) return [];
  const notify = opts.notify ?? true;

  const [achievements, facts, existing] = await Promise.all([
    prisma.achievement.findMany({ where: { isActive: true } }),
    gatherAchievementFacts(userId),
    prisma.userAchievement.findMany({ where: { userId } }),
  ]);
  const existingMap = new Map(existing.map((ua) => [ua.achievementId, ua]));

  const unlocked: string[] = [];

  for (const ach of achievements) {
    const { progress, satisfied } = evaluateCriteria(
      ach.criteria as unknown as Criteria,
      facts,
    );
    const alreadyUnlocked = !!existingMap.get(ach.id)?.unlockedAt;
    const freshUnlock = satisfied && !alreadyUnlocked;

    await prisma.userAchievement.upsert({
      where: { userId_achievementId: { userId, achievementId: ach.id } },
      create: {
        userId,
        achievementId: ach.id,
        progress,
        unlockedAt: freshUnlock ? new Date() : null,
      },
      update: {
        progress,
        ...(freshUnlock ? { unlockedAt: new Date() } : {}),
      },
    });

    if (!freshUnlock) continue;

    // Bonus XP achievement (idempotent).
    if (ach.xpReward > 0) {
      await grantXp({
        userId,
        amount: ach.xpReward,
        reason: "ACHIEVEMENT",
        dedupeKey: `achievement:${userId}:${ach.key}`,
        refType: "achievement",
        refId: ach.key,
      });
    }

    // Grant cosmetic yang terkait (idempotent).
    if (ach.unlocksCosmeticKey) {
      const item = await prisma.cosmeticItem.findUnique({
        where: { key: ach.unlocksCosmeticKey },
        select: { id: true },
      });
      if (item) {
        await prisma.userCosmetic.createMany({
          data: [{ userId, cosmeticItemId: item.id, source: "ACHIEVEMENT" }],
          skipDuplicates: true,
        });
      }
    }

    if (notify) {
      await notifyUser(
        userId,
        `🏆 Pencapaian baru: ${ach.name}`,
        NotificationType.ACHIEVEMENT_UNLOCKED,
      );
    }

    unlocked.push(ach.key);
  }

  return unlocked;
}
