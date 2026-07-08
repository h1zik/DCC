/**
 * XP absensi: dipanggil setelah verified CHECK_IN dibuat. Menghitung streak
 * (akhir pekan tak memutus), memberi XP dasar × multiplier (bila on-time), dan
 * meng-update streak progression. Idempotent per hari via dedupeKey.
 * Hanya untuk EMPLOYEE (FREELANCE tak ikut absensi).
 */
import type { EmploymentType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ATTENDANCE_ONTIME_CUTOFF, XP } from "./constants";
import { isProfileGamificationEnabled } from "./flag";
import { grantXp } from "./grant";
import { nextStreak, streakMultiplier } from "./streak";
import { isOnTimeCheckIn } from "./time";

export type CheckInResult = {
  granted: boolean;
  leveledUp: boolean;
  level: number;
  streak: number;
  onTime: boolean;
  amount: number;
};

const SKIPPED: CheckInResult = {
  granted: false,
  leveledUp: false,
  level: 1,
  streak: 0,
  onTime: false,
  amount: 0,
};

export async function onVerifiedCheckIn(args: {
  userId: string;
  /** Attendance.date "YYYY-MM-DD" (hari kalender Asia/Jakarta). */
  date: string;
  /** Attendance.timestamp (UTC). */
  timestamp: Date;
  employmentType?: EmploymentType;
}): Promise<CheckInResult> {
  if (!(await isProfileGamificationEnabled())) return SKIPPED;
  if (args.employmentType && args.employmentType !== "EMPLOYEE") return SKIPPED;

  return prisma.$transaction(async (tx) => {
    const prog = await tx.userProgression.findUnique({
      where: { userId: args.userId },
    });
    const prevStreak = prog?.attendanceStreak ?? 0;
    const streak = nextStreak(prevStreak, prog?.lastCheckinDate ?? null, args.date);

    const onTime = isOnTimeCheckIn(args.timestamp, ATTENDANCE_ONTIME_CUTOFF);
    const multiplier = onTime ? streakMultiplier(streak) : 1;
    const amount = Math.round(XP.CHECKIN_BASE * multiplier);

    const result = await grantXp({
      userId: args.userId,
      amount,
      reason: "ATTENDANCE",
      dedupeKey: `attendance:${args.userId}:${args.date}`,
      refType: "attendance",
      refId: args.date,
      tx,
    });

    // Streak diperbarui sekali per hari (hanya saat grant baru berhasil).
    if (result.granted) {
      await tx.userProgression.update({
        where: { userId: args.userId },
        data: {
          attendanceStreak: streak,
          longestAttendanceStreak: Math.max(
            prog?.longestAttendanceStreak ?? 0,
            streak,
          ),
          lastCheckinDate: args.date,
        },
      });
    }

    return {
      granted: result.granted,
      leveledUp: result.leveledUp,
      level: result.level,
      streak: result.granted ? streak : prevStreak,
      onTime,
      amount: result.granted ? amount : 0,
    };
  });
}
