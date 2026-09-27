import "server-only";

import { KolScheduleStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** Status slot yang mengikat budget (komitmen biaya). */
export const COMMITTED_STATUSES: KolScheduleStatus[] = [
  KolScheduleStatus.PENDING_APPROVAL,
  KolScheduleStatus.APPROVED,
  KolScheduleStatus.SCHEDULED,
  KolScheduleStatus.POSTED,
];

type Client = Prisma.TransactionClient | typeof prisma;

export type BudgetUsage = {
  budgetId: string;
  beginning: number;
  /** Terkomitmen: slot menunggu approval s.d. tayang. */
  committed: number;
  /** Bagian dari `committed` yang masih menunggu approval. */
  pending: number;
  remaining: number;
};

/**
 * Hitung pemakaian beberapa budget sekaligus. Satu budget bisa dipakai
 * beberapa campaign, jadi agregasi lewat relasi campaign → budget.
 */
export async function computeBudgetUsage(
  client: Client,
  budgetIds: string[],
): Promise<Map<string, BudgetUsage>> {
  const out = new Map<string, BudgetUsage>();
  if (budgetIds.length === 0) return out;

  const [budgets, rows] = await Promise.all([
    client.kolBudget.findMany({
      where: { id: { in: budgetIds } },
      select: { id: true, beginningBalance: true },
    }),
    client.kolSchedule.findMany({
      where: {
        status: { in: COMMITTED_STATUSES },
        campaign: { budgetId: { in: budgetIds } },
      },
      select: {
        rate: true,
        additionalCost: true,
        status: true,
        campaign: { select: { budgetId: true } },
      },
    }),
  ]);

  for (const b of budgets) {
    const beginning = Number(b.beginningBalance);
    out.set(b.id, {
      budgetId: b.id,
      beginning,
      committed: 0,
      pending: 0,
      remaining: beginning,
    });
  }
  for (const r of rows) {
    const u = out.get(r.campaign.budgetId);
    if (!u) continue;
    const amount = Number(r.rate) + Number(r.additionalCost);
    u.committed += amount;
    if (r.status === KolScheduleStatus.PENDING_APPROVAL) u.pending += amount;
  }
  for (const u of out.values()) u.remaining = u.beginning - u.committed;
  return out;
}

/**
 * Kunci baris budget sampai transaksi selesai, lalu pastikan tambahan biaya
 * masih muat. Dua pengajuan bersamaan ke budget yang sama jadi berurutan,
 * sehingga tidak ada yang lolos melewati sisa budget.
 */
export async function assertBudgetFits(
  tx: Prisma.TransactionClient,
  budgetId: string,
  additional: number,
) {
  await tx.$queryRaw`SELECT 1 FROM "KolBudget" WHERE "id" = ${budgetId} FOR UPDATE`;
  const usage = (await computeBudgetUsage(tx, [budgetId])).get(budgetId);
  if (!usage) throw new Error("Budget campaign tidak ditemukan.");
  if (additional > usage.remaining + 0.005) {
    const fmt = new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    });
    throw new Error(
      `Melebihi budget: butuh ${fmt.format(additional)}, sisa budget ${fmt.format(Math.max(0, usage.remaining))}.`,
    );
  }
  return usage;
}
