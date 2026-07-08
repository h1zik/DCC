/**
 * XP kesegaran data (cron only). Memberi XP ke user yang menjaga sebuah modul
 * tetap "fresh" pada ISO-week berjalan — dinilai dari timestamp "last updated"
 * modul (bukan jumlah edit). Idempotent per (modul, user, minggu) via dedupeKey.
 */
import { prisma } from "@/lib/prisma";
import { XP } from "./constants";
import { isProfileGamificationEnabled } from "./flag";
import { grantXp } from "./grant";
import { isoWeekKey, isoWeekRange } from "./time";

/** User yang mem-posting jurnal keuangan pada rentang minggu ini. */
async function financeFreshUserIds(start: Date, end: Date): Promise<string[]> {
  const rows = await prisma.financeJournalEntry.findMany({
    where: { postedAt: { gte: start, lt: end }, postedById: { not: null } },
    select: { postedById: true },
    distinct: ["postedById"],
  });
  return rows
    .map((r) => r.postedById)
    .filter((id): id is string => Boolean(id));
}

/** User yang meng-update laporan research jadi READY pada rentang minggu ini. */
async function researchFreshUserIds(start: Date, end: Date): Promise<string[]> {
  const rows = await prisma.researchReport.findMany({
    where: { updatedAt: { gte: start, lt: end }, status: "READY" },
    select: { createdById: true },
    distinct: ["createdById"],
  });
  return rows.map((r) => r.createdById);
}

/**
 * Beri XP kesegaran data untuk minggu yang memuat `ref` (default sekarang).
 * Menambah modul baru = tambah entri di `sources`.
 */
export async function runFreshnessGrants(
  ref: Date = new Date(),
): Promise<Array<{ module: string; users: number }>> {
  if (!(await isProfileGamificationEnabled())) return [];

  const { start, end } = isoWeekRange(ref);
  const weekKey = isoWeekKey(ref);

  const sources: Array<{ module: string; userIds: string[] }> = [
    { module: "finance", userIds: await financeFreshUserIds(start, end) },
    { module: "research", userIds: await researchFreshUserIds(start, end) },
  ];

  const summary: Array<{ module: string; users: number }> = [];
  for (const source of sources) {
    for (const userId of source.userIds) {
      await grantXp({
        userId,
        amount: XP.DATA_FRESH,
        reason: "DATA_FRESH",
        dedupeKey: `data_fresh:${source.module}:${userId}:${weekKey}`,
        refType: "module",
        refId: source.module,
      });
    }
    summary.push({ module: source.module, users: source.userIds.length });
  }
  return summary;
}
