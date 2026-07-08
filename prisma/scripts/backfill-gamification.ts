/**
 * Backfill gamifikasi profil (idempotent, ADDITIVE, aman diulang & aman di prod).
 *
 *   npx tsx prisma/scripts/backfill-gamification.ts
 *   (atau `npm run db:backfill-gamification`)
 *
 * Untuk tiap user:
 *  1. Seed XP tenure = cumXp(levelKeanggotaanLama) → LANTAI level (tak ada yang
 *     turun; `levelFloor` + max(...) di grant/recompute menjamin ini).
 *  2. Rekonsiliasi streak absensi historis dari tabel Attendance (read-only).
 *  3. recompute progression + evaluasi achievement historis (notify:false).
 *
 * TIDAK menyentuh data absensi/task/finance — hanya menulis state gamifikasi.
 * Task on-time TIDAK di-backfill (forward-only; updatedAt tak reliabel).
 * Flag di-set on di dalam script agar data terisi terlepas dari flag deploy
 * (flag deploy hanya mengatur tampilan front-end).
 */
process.env.PROFILE_GAMIFICATION_ENABLED = "true";

import { prisma } from "../../src/lib/prisma";
import { evaluateAchievements } from "../../src/lib/gamification/achievements";
import { grantXp, recomputeProgression } from "../../src/lib/gamification/grant";
import { cumXp } from "../../src/lib/gamification/level";
import {
  bridgesOnlyWeekend,
  computeHistoricalStreak,
} from "../../src/lib/gamification/streak";
import { jakartaDateString } from "../../src/lib/gamification/time";
import {
  describeDatabaseHost,
  isLocalDatabase,
  loadDatabaseUrl,
} from "./db-env";

const DAY_MS = 86_400_000;

function tenureLevel(createdAt: Date): number {
  const days = Math.max(0, Math.floor((Date.now() - createdAt.getTime()) / DAY_MS));
  return Math.max(1, Math.floor(days / 30) + 1);
}

async function main() {
  const dbUrl = loadDatabaseUrl();
  console.log(
    `[backfill-gamification] target DB: ${describeDatabaseHost(dbUrl)} (local=${isLocalDatabase(dbUrl)})`,
  );

  const users = await prisma.user.findMany({
    select: { id: true, createdAt: true },
  });
  const today = jakartaDateString(new Date());

  let processed = 0;
  let unlockedTotal = 0;

  for (const user of users) {
    const oldLevel = tenureLevel(user.createdAt);
    const seededXp = cumXp(oldLevel);

    // 1. Seed tenure XP + lantai level (idempotent via dedupeKey).
    await grantXp({
      userId: user.id,
      amount: seededXp,
      reason: "TENURE",
      dedupeKey: `tenure:${user.id}`,
      refType: "tenure",
      levelFloor: oldLevel,
    });

    // 2. Streak absensi historis (read-only dari Attendance).
    const rows = await prisma.attendance.findMany({
      where: { userId: user.id, type: "CHECK_IN", confidence: { gt: 0 } },
      select: { date: true },
      orderBy: { date: "asc" },
    });
    const dates = [...new Set(rows.map((r) => r.date))].sort();
    const { current, longest } = computeHistoricalStreak(dates);
    const lastDate = dates[dates.length - 1] ?? null;
    const alive =
      !!lastDate &&
      (lastDate === today || bridgesOnlyWeekend(lastDate, today));

    const prog = await prisma.userProgression.findUnique({
      where: { userId: user.id },
    });
    await prisma.userProgression.update({
      where: { userId: user.id },
      data: {
        attendanceStreak: alive ? current : 0,
        longestAttendanceStreak: Math.max(
          prog?.longestAttendanceStreak ?? 0,
          longest,
        ),
        lastCheckinDate: lastDate ?? prog?.lastCheckinDate ?? null,
      },
    });

    // 3. Self-heal + evaluasi achievement historis (tanpa notifikasi).
    await recomputeProgression(user.id, { levelFloor: oldLevel });
    const newly = await evaluateAchievements(user.id, { notify: false });
    unlockedTotal += newly.length;
    processed += 1;
  }

  console.log(
    `[backfill-gamification] selesai: ${processed} user diproses, ${unlockedTotal} achievement historis terbuka.`,
  );
}

// Jalankan hanya bila dieksekusi langsung (bukan saat di-import test).
if (require.main === module) {
  main()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
