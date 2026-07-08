/**
 * Rekonsiliasi harian gamifikasi (dipanggil cron). Idempotent & aman diulang:
 * (1) XP kesegaran data minggu ini, (2) recompute progression (self-heal),
 * (3) evaluasi achievement (menutup event yang terlewat). Di-gate feature flag.
 */
import { prisma } from "@/lib/prisma";
import { evaluateAchievements } from "./achievements";
import { isProfileGamificationEnabled } from "./flag";
import { runFreshnessGrants } from "./freshness-xp";
import { recomputeProgression } from "./grant";

export type ReconcileResult = {
  skipped?: boolean;
  freshness?: Array<{ module: string; users: number }>;
  usersProcessed?: number;
  achievementsUnlocked?: number;
};

export async function reconcileGamification(
  ref: Date = new Date(),
): Promise<ReconcileResult> {
  if (!(await isProfileGamificationEnabled())) return { skipped: true };

  // 1. Kesegaran data mingguan (juga menciptakan progression bagi kontributor baru).
  const freshness = await runFreshnessGrants(ref);

  // 2 & 3. Per user berprogress: self-heal xp/level + evaluasi achievement.
  const users = await prisma.userProgression.findMany({
    select: { userId: true },
  });

  let usersProcessed = 0;
  let achievementsUnlocked = 0;
  for (const { userId } of users) {
    await recomputeProgression(userId);
    const newly = await evaluateAchievements(userId, { notify: true });
    achievementsUnlocked += newly.length;
    usersProcessed += 1;
  }

  return { freshness, usersProcessed, achievementsUnlocked };
}
