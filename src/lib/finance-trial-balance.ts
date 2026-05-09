import "server-only";

import {
  FinanceJournalStatus,
  FinanceLedgerType,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { zeroDecimal } from "@/lib/finance-money";

export type TrialBalanceRow = {
  accountId: string;
  code: string;
  name: string;
  type: FinanceLedgerType;
  debit: Prisma.Decimal;
  credit: Prisma.Decimal;
};

export type TrialBalanceResult = {
  rows: TrialBalanceRow[];
  totals: { debit: Prisma.Decimal; credit: Prisma.Decimal };
  isBalanced: boolean;
  asOf: Date;
};

/**
 * Neraca Saldo (Trial Balance) — laporan fundamental akuntansi.
 *
 * Setiap akun ditampilkan satu baris dengan saldonya pada sisi alami
 * (akun debit normal: aktiva & beban → kolom debit; akun kredit normal:
 * kewajiban, ekuitas, pendapatan → kolom kredit). Total debit harus sama
 * dengan total kredit; jika tidak, ada jurnal tidak seimbang.
 *
 * Sumber data: hanya jurnal berstatus POSTED s/d `asOf`. Filter brand
 * opsional (laporan segmen).
 */
export async function buildTrialBalance(options: {
  asOf: Date;
  brandId?: string | null;
  /** Bila true, hanya tampilkan akun yang mempunyai mutasi (lebih ringkas). */
  hideZero?: boolean;
}): Promise<TrialBalanceResult> {
  const end = endOfDay(options.asOf);

  const [accounts, lines] = await Promise.all([
    prisma.financeLedgerAccount.findMany({
      orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
      select: { id: true, code: true, name: true, type: true, isActive: true },
    }),
    prisma.financeJournalLine.findMany({
      where: {
        entry: {
          status: FinanceJournalStatus.POSTED,
          entryDate: { lte: end },
        },
        ...(options.brandId ? { brandId: options.brandId } : {}),
      },
      select: {
        accountId: true,
        debitBase: true,
        creditBase: true,
      },
    }),
  ]);

  const totalsByAccount = new Map<
    string,
    { debit: Prisma.Decimal; credit: Prisma.Decimal }
  >();
  for (const line of lines) {
    const cur = totalsByAccount.get(line.accountId) ?? {
      debit: zeroDecimal(),
      credit: zeroDecimal(),
    };
    totalsByAccount.set(line.accountId, {
      debit: cur.debit.plus(line.debitBase),
      credit: cur.credit.plus(line.creditBase),
    });
  }

  const rows: TrialBalanceRow[] = [];
  let totalDebit = zeroDecimal();
  let totalCredit = zeroDecimal();

  for (const acc of accounts) {
    const t = totalsByAccount.get(acc.id) ?? {
      debit: zeroDecimal(),
      credit: zeroDecimal(),
    };
    // Saldo bersih dipresentasikan pada sisi naturalnya
    const net = t.debit.minus(t.credit);
    let debit = zeroDecimal();
    let credit = zeroDecimal();
    if (isDebitNormal(acc.type)) {
      if (net.gte(0)) debit = net;
      else credit = net.abs();
    } else {
      if (net.lte(0)) credit = net.abs();
      else debit = net;
    }
    if (options.hideZero && debit.isZero() && credit.isZero()) continue;

    rows.push({
      accountId: acc.id,
      code: acc.code,
      name: acc.name,
      type: acc.type,
      debit,
      credit,
    });
    totalDebit = totalDebit.plus(debit);
    totalCredit = totalCredit.plus(credit);
  }

  return {
    rows,
    totals: { debit: totalDebit, credit: totalCredit },
    isBalanced: totalDebit.equals(totalCredit),
    asOf: end,
  };
}

function isDebitNormal(t: FinanceLedgerType): boolean {
  return t === FinanceLedgerType.ASSET || t === FinanceLedgerType.EXPENSE;
}

function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}
