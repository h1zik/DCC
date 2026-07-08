/**
 * Inti pemberian XP: idempotent via `XpLedger.dedupeKey @unique` + recompute
 * `UserProgression`. Level TIDAK PERNAH turun (lantai = level tersimpan / floor
 * eksplisit) — menjaga invarian "level lama tak boleh berkurang" bahkan bila
 * kurva berubah.
 */
import type { Prisma, XpReason } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { levelFromXp } from "./level";

type Tx = Prisma.TransactionClient;

export type GrantResult = {
  /** True hanya bila baris ledger BARU dibuat (bukan duplikat). */
  granted: boolean;
  leveledUp: boolean;
  level: number;
  previousLevel: number;
  xpTotal: number;
};

export type GrantArgs = {
  userId: string;
  amount: number;
  reason: XpReason;
  /** Kunci idempotensi unik per-event. */
  dedupeKey: string;
  refType?: string | null;
  refId?: string | null;
  /** Lantai level eksplisit (mis. level keanggotaan lama saat backfill). */
  levelFloor?: number;
  /** Transaksi induk; bila kosong, grant dibungkus transaksi sendiri. */
  tx?: Tx;
};

async function runGrant(client: Tx, args: GrantArgs): Promise<GrantResult> {
  const inserted = await client.xpLedger.createMany({
    data: [
      {
        userId: args.userId,
        amount: args.amount,
        reason: args.reason,
        dedupeKey: args.dedupeKey,
        refType: args.refType ?? null,
        refId: args.refId ?? null,
      },
    ],
    skipDuplicates: true,
  });

  const existing = await client.userProgression.findUnique({
    where: { userId: args.userId },
  });
  const previousLevel = existing?.level ?? 1;
  const previousXp = existing?.xpTotal ?? 0;

  // Duplikat: event sudah pernah di-grant → tak ada perubahan.
  if (inserted.count === 0) {
    return {
      granted: false,
      leveledUp: false,
      level: previousLevel,
      previousLevel,
      xpTotal: previousXp,
    };
  }

  const newXpTotal = previousXp + args.amount;
  const floor = Math.max(previousLevel, args.levelFloor ?? 1);
  const newLevel = Math.max(levelFromXp(newXpTotal), floor);

  await client.userProgression.upsert({
    where: { userId: args.userId },
    create: { userId: args.userId, xpTotal: newXpTotal, level: newLevel },
    update: { xpTotal: { increment: args.amount }, level: newLevel },
  });

  return {
    granted: true,
    leveledUp: newLevel > previousLevel,
    level: newLevel,
    previousLevel,
    xpTotal: newXpTotal,
  };
}

/** Grant XP idempotent. Aman dipanggil ulang dengan `dedupeKey` yang sama. */
export function grantXp(args: GrantArgs): Promise<GrantResult> {
  if (args.tx) return runGrant(args.tx, args);
  return prisma.$transaction((tx) => runGrant(tx, args));
}

/**
 * Recompute `UserProgression` dari sumber kebenaran (jumlah `XpLedger`) untuk
 * self-heal (dipakai cron). Level baru = max(levelFromXp(sum), level tersimpan,
 * levelFloor) — tak pernah turun.
 */
export async function recomputeProgression(
  userId: string,
  opts: { levelFloor?: number; tx?: Tx } = {},
): Promise<{ level: number; xpTotal: number }> {
  const client = opts.tx ?? prisma;
  const agg = await client.xpLedger.aggregate({
    where: { userId },
    _sum: { amount: true },
  });
  const xpTotal = agg._sum.amount ?? 0;
  const existing = await client.userProgression.findUnique({ where: { userId } });
  const floor = Math.max(existing?.level ?? 1, opts.levelFloor ?? 1);
  const level = Math.max(levelFromXp(xpTotal), floor);
  await client.userProgression.upsert({
    where: { userId },
    create: { userId, xpTotal, level },
    update: { xpTotal, level },
  });
  return { level, xpTotal };
}
