"use server";

import { FinanceLedgerType, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireFinance } from "@/lib/auth-helpers";
import { signedBalanceForAccount } from "@/lib/finance-money";
import { buildTrialBalance } from "@/lib/finance-trial-balance";
import { buildCashFlowStatement } from "@/lib/finance-cashflow";

const rangeSchema = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
  brandId: z.string().optional().nullable(),
  /** Hanya baris jurnal tanpa tag brand. */
  onlyUntagged: z.boolean().optional(),
});

function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export async function reportProfitLoss(input: z.infer<typeof rangeSchema>) {
  await requireFinance();
  const q = rangeSchema.parse(input);
  const brandWhere =
    q.onlyUntagged === true
      ? { brandId: null }
      : q.brandId
        ? { brandId: q.brandId }
        : {};

  const lines = await prisma.financeJournalLine.findMany({
    where: {
      entry: {
        status: "POSTED",
        entryDate: { gte: q.from, lte: endOfDay(q.to) },
      },
      account: { type: { in: [FinanceLedgerType.REVENUE, FinanceLedgerType.EXPENSE] } },
      ...brandWhere,
    },
    include: { account: true },
  });

  const byAccount = new Map<
    string,
    { name: string; code: string; type: FinanceLedgerType; amount: Prisma.Decimal }
  >();

  for (const line of lines) {
    const net = signedBalanceForAccount(
      line.account.type,
      line.debitBase,
      line.creditBase,
    );
    const cur = byAccount.get(line.accountId);
    if (!cur) {
      byAccount.set(line.accountId, {
        name: line.account.name,
        code: line.account.code,
        type: line.account.type,
        amount: net,
      });
    } else {
      byAccount.set(line.accountId, { ...cur, amount: cur.amount.plus(net) });
    }
  }

  let revenue = new Prisma.Decimal(0);
  let expense = new Prisma.Decimal(0);
  for (const row of byAccount.values()) {
    if (row.type === FinanceLedgerType.REVENUE) revenue = revenue.plus(row.amount);
    if (row.type === FinanceLedgerType.EXPENSE) expense = expense.plus(row.amount);
  }

  return {
    rows: [...byAccount.values()],
    revenue,
    expense,
    netIncome: revenue.minus(expense),
  };
}

export async function reportBalanceSheet(asOf: Date, brandId?: string | null) {
  await requireFinance();
  const lines = await prisma.financeJournalLine.findMany({
    where: {
      entry: {
        status: "POSTED",
        entryDate: { lte: endOfDay(asOf) },
      },
      account: {
        type: {
          in: [
            FinanceLedgerType.ASSET,
            FinanceLedgerType.LIABILITY,
            FinanceLedgerType.EQUITY,
          ],
        },
      },
      ...(brandId ? { brandId } : {}),
    },
    include: { account: true },
  });

  const pl = await reportProfitLoss({
    from: new Date(0),
    to: asOf,
    brandId: brandId ?? null,
  });

  const byAccount = new Map<
    string,
    { name: string; code: string; type: FinanceLedgerType; amount: Prisma.Decimal }
  >();

  for (const line of lines) {
    const net = signedBalanceForAccount(
      line.account.type,
      line.debitBase,
      line.creditBase,
    );
    const cur = byAccount.get(line.accountId);
    if (!cur) {
      byAccount.set(line.accountId, {
        name: line.account.name,
        code: line.account.code,
        type: line.account.type,
        amount: net,
      });
    } else {
      byAccount.set(line.accountId, { ...cur, amount: cur.amount.plus(net) });
    }
  }

  const retained = pl.netIncome;

  return {
    assets: [...byAccount.values()].filter((r) => r.type === FinanceLedgerType.ASSET),
    liabilities: [...byAccount.values()].filter(
      (r) => r.type === FinanceLedgerType.LIABILITY,
    ),
    equity: [...byAccount.values()].filter((r) => r.type === FinanceLedgerType.EQUITY),
    retainedEarnings: retained,
  };
}

export async function reportCashFlow(input: z.infer<typeof rangeSchema>) {
  await requireFinance();
  const q = rangeSchema.parse(input);
  const lines = await prisma.financeJournalLine.findMany({
    where: {
      entry: {
        status: "POSTED",
        entryDate: { gte: q.from, lte: endOfDay(q.to) },
      },
      account: { tracksCashflow: true },
      ...(q.brandId ? { brandId: q.brandId } : {}),
    },
    include: { account: true, entry: true },
    orderBy: [{ entry: { entryDate: "asc" } }],
  });

  let net = new Prisma.Decimal(0);
  const detail = lines.map((line) => {
    const delta = signedBalanceForAccount(
      FinanceLedgerType.ASSET,
      line.debitBase,
      line.creditBase,
    );
    net = net.plus(delta);
    return {
      id: line.id,
      date: line.entry.entryDate,
      reference: line.entry.reference,
      account: line.account.name,
      memo: line.memo,
      delta,
    };
  });

  return { detail, netOperatingCashApprox: net };
}

export async function reportTaxBuckets(input: z.infer<typeof rangeSchema>) {
  await requireFinance();
  const q = rangeSchema.parse(input);
  const taxCodes = ["2100", "2200"];
  const accounts = await prisma.financeLedgerAccount.findMany({
    where: { code: { in: taxCodes } },
  });
  const idByCode = new Map(accounts.map((a) => [a.code, a.id]));

  const lines = await prisma.financeJournalLine.findMany({
    where: {
      entry: {
        status: "POSTED",
        entryDate: { gte: q.from, lte: endOfDay(q.to) },
      },
      accountId: { in: [...idByCode.values()] },
      ...(q.brandId ? { brandId: q.brandId } : {}),
    },
    include: { account: true },
  });

  const sums = new Map<string, Prisma.Decimal>();
  for (const code of taxCodes) {
    sums.set(code, new Prisma.Decimal(0));
  }
  for (const line of lines) {
    const net = signedBalanceForAccount(
      line.account.type,
      line.debitBase,
      line.creditBase,
    );
    const code = line.account.code;
    sums.set(code, (sums.get(code) ?? new Prisma.Decimal(0)).plus(net));
  }

  return {
    rows: taxCodes.map((code) => ({
      code,
      label:
        code === "2100"
          ? "Utang PPN (mutasi periode)"
          : "Utang PPh (mutasi periode)",
      amount: sums.get(code) ?? new Prisma.Decimal(0),
    })),
  };
}

/**
 * Neraca Saldo (Trial Balance) — fundamental akuntansi.
 * Total kolom debit harus = total kolom kredit; jika tidak, ada
 * jurnal terposting yang tidak seimbang (data corruption).
 */
export async function reportTrialBalance(input: {
  asOf: Date;
  brandId?: string | null;
  hideZero?: boolean;
}) {
  await requireFinance();
  return buildTrialBalance(input);
}

/**
 * Laporan Arus Kas terkategorisasi (operasi / investasi / pendanaan).
 */
export async function reportCashFlowStatement(input: z.infer<typeof rangeSchema>) {
  await requireFinance();
  const q = rangeSchema.parse(input);
  return buildCashFlowStatement({
    from: q.from,
    to: q.to,
    brandId: q.brandId ?? null,
  });
}

/**
 * Laporan L/R perbandingan (current vs prior period). Akun-akun digabung
 * menggunakan `accountId` agar baris konsisten antar periode.
 */
export async function reportProfitLossComparison(input: {
  from: Date;
  to: Date;
  brandId?: string | null;
}) {
  await requireFinance();
  const periodLength = input.to.getTime() - input.from.getTime();
  const prevTo = new Date(input.from.getTime() - 1);
  const prevFrom = new Date(prevTo.getTime() - periodLength);

  const [curr, prev] = await Promise.all([
    reportProfitLoss({
      from: input.from,
      to: input.to,
      brandId: input.brandId ?? null,
    }),
    reportProfitLoss({ from: prevFrom, to: prevTo, brandId: input.brandId ?? null }),
  ]);

  type Row = {
    code: string;
    name: string;
    type: FinanceLedgerType;
    current: Prisma.Decimal;
    previous: Prisma.Decimal;
  };

  const map = new Map<string, Row>();
  for (const r of curr.rows) {
    map.set(`${r.type}|${r.code}`, {
      code: r.code,
      name: r.name,
      type: r.type,
      current: r.amount,
      previous: new Prisma.Decimal(0),
    });
  }
  for (const r of prev.rows) {
    const key = `${r.type}|${r.code}`;
    const existing = map.get(key);
    if (existing) existing.previous = r.amount;
    else
      map.set(key, {
        code: r.code,
        name: r.name,
        type: r.type,
        current: new Prisma.Decimal(0),
        previous: r.amount,
      });
  }

  const rows = [...map.values()].sort((a, b) => a.code.localeCompare(b.code));

  return {
    rows,
    revenue: { current: curr.revenue, previous: prev.revenue },
    expense: { current: curr.expense, previous: prev.expense },
    netIncome: { current: curr.netIncome, previous: prev.netIncome },
    period: { from: input.from, to: input.to },
    previousPeriod: { from: prevFrom, to: prevTo },
  };
}

/**
 * Laporan Neraca perbandingan (current vs prior tanggal cut-off).
 */
export async function reportBalanceSheetComparison(input: {
  asOf: Date;
  brandId?: string | null;
}) {
  await requireFinance();
  const previousAsOf = new Date(input.asOf);
  previousAsOf.setMonth(previousAsOf.getMonth() - 1);
  const [curr, prev] = await Promise.all([
    reportBalanceSheet(input.asOf, input.brandId ?? null),
    reportBalanceSheet(previousAsOf, input.brandId ?? null),
  ]);
  return {
    asOf: input.asOf,
    previousAsOf,
    current: curr,
    previous: prev,
  };
}

export async function reportProfitLossByBrand(input: z.infer<typeof rangeSchema>) {
  await requireFinance();
  const q = rangeSchema.parse(input);
  const brands = await prisma.brand.findMany({ orderBy: { name: "asc" } });
  const out: { brandId: string | null; brandName: string; netIncome: Prisma.Decimal }[] = [];

  const untagged = await reportProfitLoss({
    from: q.from,
    to: q.to,
    brandId: null,
    onlyUntagged: true,
  });
  out.push({
    brandId: null,
    brandName: "Tanpa tag brand",
    netIncome: untagged.netIncome,
  });

  for (const b of brands) {
    const pl = await reportProfitLoss({
      from: q.from,
      to: q.to,
      brandId: b.id,
    });
    out.push({
      brandId: b.id,
      brandName: b.name,
      netIncome: pl.netIncome,
    });
  }

  return out;
}
