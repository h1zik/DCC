"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireFinance } from "@/lib/auth-helpers";
import { listPeriodLocks } from "@/lib/finance-period-lock";

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

  await prisma.financePeriodLock.upsert({
    where: { year_month: { year: data.year, month: data.month } },
    create: {
      year: data.year,
      month: data.month,
      lockedById: session.user.id,
      reason: data.reason?.trim() || null,
    },
    update: {
      lockedById: session.user.id,
      lockedAt: new Date(),
      reason: data.reason?.trim() || null,
    },
  });
  paths();
}

const unlockSchema = z.object({
  year: z.number().int().min(2000).max(2200),
  month: z.number().int().min(1).max(12),
});

export async function unlockFinancePeriod(
  input: z.infer<typeof unlockSchema>,
) {
  await requireFinance();
  const data = unlockSchema.parse(input);
  await prisma.financePeriodLock.deleteMany({
    where: { year: data.year, month: data.month },
  });
  paths();
}
