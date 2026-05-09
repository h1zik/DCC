"use server";

import { FinanceLedgerType, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireFinance } from "@/lib/auth-helpers";
import { defaultCoaCreateMany } from "@/lib/finance-default-coa";
import { signedBalanceForAccount } from "@/lib/finance-money";

export async function ensureFinanceCoaReady() {
  await requireFinance();
  const count = await prisma.financeLedgerAccount.count();
  if (count > 0) {
    // Backfill: jika kolom flag baru (isApControl/isArControl) belum di-set
    // pada akun standar 2000 / 1200, isi sekali. Idempotent.
    await prisma.$transaction([
      prisma.financeLedgerAccount.updateMany({
        where: { code: "2000", isApControl: false },
        data: { isApControl: true },
      }),
      prisma.financeLedgerAccount.updateMany({
        where: { code: "1200", isArControl: false },
        data: { isArControl: true },
      }),
    ]);
    return { seeded: false as const };
  }
  await prisma.financeLedgerAccount.createMany({
    data: defaultCoaCreateMany(),
  });
  return { seeded: true as const };
}

export async function listFinanceAccounts(options?: { includeInactive?: boolean }) {
  await requireFinance();
  return prisma.financeLedgerAccount.findMany({
    where: options?.includeInactive ? {} : { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
  });
}

const upsertSchema = z.object({
  id: z.string().optional(),
  code: z.string().min(1).max(32),
  name: z.string().min(1).max(200),
  type: z.nativeEnum(FinanceLedgerType),
  sortOrder: z.number().int().optional(),
  tracksCashflow: z.boolean().optional(),
  isActive: z.boolean().optional(),
  isApControl: z.boolean().optional(),
  isArControl: z.boolean().optional(),
});

export async function upsertFinanceLedgerAccount(
  input: z.infer<typeof upsertSchema>,
) {
  await requireFinance();
  const data = upsertSchema.parse(input);

  // Sanity guard: AP control hanya untuk LIABILITY, AR control hanya untuk ASSET.
  if (data.isApControl && data.type !== FinanceLedgerType.LIABILITY) {
    throw new Error(
      "AP control hanya boleh diaktifkan pada akun bertipe Liabilitas (mis. Hutang Usaha).",
    );
  }
  if (data.isArControl && data.type !== FinanceLedgerType.ASSET) {
    throw new Error(
      "AR control hanya boleh diaktifkan pada akun bertipe Aktiva (mis. Piutang Usaha).",
    );
  }

  if (data.id) {
    await prisma.financeLedgerAccount.update({
      where: { id: data.id },
      data: {
        code: data.code,
        name: data.name,
        type: data.type,
        sortOrder: data.sortOrder ?? undefined,
        tracksCashflow: data.tracksCashflow ?? undefined,
        isActive: data.isActive ?? undefined,
        isApControl: data.isApControl ?? undefined,
        isArControl: data.isArControl ?? undefined,
      },
    });
  } else {
    await prisma.financeLedgerAccount.create({
      data: {
        code: data.code,
        name: data.name,
        type: data.type,
        sortOrder: data.sortOrder ?? 0,
        tracksCashflow: data.tracksCashflow ?? false,
        isActive: data.isActive ?? true,
        isApControl: data.isApControl ?? false,
        isArControl: data.isArControl ?? false,
      },
    });
  }

  revalidatePath("/finance");
  revalidatePath("/finance/chart-of-accounts");
}

export async function getFinanceLedgerAccountByCode(code: string) {
  await requireFinance();
  return prisma.financeLedgerAccount.findUnique({ where: { code } });
}

export async function deactivateFinanceAccount(accountId: string) {
  await requireFinance();
  await prisma.financeLedgerAccount.update({
    where: { id: accountId },
    data: { isActive: false },
  });
  revalidatePath("/finance/chart-of-accounts");
}

export async function setFinanceAccountActive(
  accountId: string,
  isActive: boolean,
) {
  await requireFinance();
  await prisma.financeLedgerAccount.update({
    where: { id: accountId },
    data: { isActive },
  });
  revalidatePath("/finance/chart-of-accounts");
}

/** Referensi untuk laporan (saldo per akun). */
export async function getFinanceAccountBalanceMap(asOf: Date) {
  await requireFinance();
  const lines = await prisma.financeJournalLine.findMany({
    where: {
      entry: {
        status: "POSTED",
        entryDate: { lte: endOfUtcDay(asOf) },
      },
    },
    include: { account: true },
  });

  const map = new Map<
    string,
    { account: (typeof lines)[0]["account"]; balance: Prisma.Decimal }
  >();

  for (const line of lines) {
    const prev = map.get(line.accountId);
    const delta = signedBalanceForAccount(
      line.account.type,
      line.debitBase,
      line.creditBase,
    );
    if (!prev) {
      map.set(line.accountId, { account: line.account, balance: delta });
    } else {
      map.set(line.accountId, {
        account: line.account,
        balance: prev.balance.plus(delta),
      });
    }
  }

  return map;
}

function endOfUtcDay(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(23, 59, 59, 999);
  return x;
}
