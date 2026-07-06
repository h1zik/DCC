"use server";

import { FinanceAuditAction, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireFinance } from "@/lib/auth-helpers";
import { listPeriodLocks } from "@/lib/finance-period-lock";
import { logFinanceAudit } from "@/lib/finance-audit";

function periodLabel(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function paths() {
  revalidatePath("/finance");
  revalidatePath("/finance/reports");
  revalidatePath("/finance/journals");
  revalidatePath("/finance/general-ledger");
}

export async function listFinancePeriodLocks(limit = 24) {
  await requireFinance();
  return listPeriodLocks(limit);
}

const lockSchema = z.object({
  year: z.number().int().min(2000).max(2200),
  month: z.number().int().min(1).max(12),
  reason: z.string().max(500).optional().nullable(),
});

export async function lockFinancePeriod(input: z.infer<typeof lockSchema>) {
  const session = await requireFinance();
  const data = lockSchema.parse(input);

  // Idempoten: bila periode sudah terkunci, JANGAN menimpa jejak pengunci
  // asli (dulu upsert menulis ulang lockedById/lockedAt setiap kali).
  const existing = await prisma.financePeriodLock.findUnique({
    where: { year_month: { year: data.year, month: data.month } },
    select: { id: true },
  });
  if (existing) return;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.financePeriodLock.create({
        data: {
          year: data.year,
          month: data.month,
          lockedById: session.user.id,
          reason: data.reason?.trim() || null,
        },
      });
      await logFinanceAudit(tx, {
        action: FinanceAuditAction.PERIOD_LOCK,
        actorId: session.user.id,
        entityId: periodLabel(data.year, data.month),
        detail: data.reason?.trim() || null,
      });
    });
  } catch (err) {
    // Race dua pengunci bersamaan: pemenang sudah mencatat; kalah = no-op.
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return;
    }
    throw err;
  }
  paths();
}

const unlockSchema = z.object({
  year: z.number().int().min(2000).max(2200),
  month: z.number().int().min(1).max(12),
});

export async function unlockFinancePeriod(
  input: z.infer<typeof unlockSchema>,
) {
  const session = await requireFinance();
  const data = unlockSchema.parse(input);

  await prisma.$transaction(async (tx) => {
    const existing = await tx.financePeriodLock.findUnique({
      where: { year_month: { year: data.year, month: data.month } },
      include: { lockedBy: { select: { name: true, email: true } } },
    });
    if (!existing) return;

    // Jejak kunci asli ikut terhapus bersama barisnya — simpan dulu ke audit
    // log supaya "siapa membuka periode tutup buku" selalu bisa ditelusuri.
    await logFinanceAudit(tx, {
      action: FinanceAuditAction.PERIOD_UNLOCK,
      actorId: session.user.id,
      entityId: periodLabel(data.year, data.month),
      detail:
        `Kunci dibuat ${existing.lockedAt.toISOString()} oleh ` +
        `${existing.lockedBy?.name ?? existing.lockedBy?.email ?? existing.lockedById}` +
        (existing.reason ? `; alasan kunci: ${existing.reason}` : ""),
    });
    await tx.financePeriodLock.delete({ where: { id: existing.id } });
  });
  paths();
}
