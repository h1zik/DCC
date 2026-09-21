import "server-only";
import {
  FinanceApArDocStatus,
  FinanceJournalStatus,
  FinanceLedgerType,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { utcMonthStart } from "@/lib/finance-dates";
import type { OpenDoc } from "./aging";
import { fillTrendMonths, type TrendRawRow } from "./trend";
import type { TrendPoint } from "./types";

const D0 = () => new Prisma.Decimal(0);

function dec(value: Prisma.Decimal | null | undefined): Prisma.Decimal {
  return value ?? D0();
}

/**
 * Pendapatan/beban per bulan untuk `months` bulan yang berakhir di
 * (endYear, endMonth) — satu query agregat, bukan 2×N `aggregate`.
 */
export async function loadMonthlyTrend(options: {
  endYear: number;
  endMonth: number;
  months: number;
  brandId: string | null;
  /** Batas atas data (akhir bulan, atau hari ini bila bulan berjalan). */
  upTo: Date;
}): Promise<TrendPoint[]> {
  const from = utcMonthStart(
    options.endYear,
    options.endMonth - (options.months - 1),
  );
  const brandFilter = options.brandId
    ? Prisma.sql`AND jl."brandId" = ${options.brandId}`
    : Prisma.empty;

  const rows = await prisma.$queryRaw<
    Array<{
      ym: string;
      type: string;
      debit: Prisma.Decimal | null;
      credit: Prisma.Decimal | null;
    }>
  >`
    SELECT
      to_char(je."entryDate", 'YYYY-MM') AS ym,
      a."type"::text AS type,
      SUM(jl."debitBase")::numeric AS debit,
      SUM(jl."creditBase")::numeric AS credit
    FROM "FinanceJournalLine" jl
    JOIN "FinanceJournalEntry" je ON je."id" = jl."entryId"
    JOIN "FinanceLedgerAccount" a ON a."id" = jl."accountId"
    WHERE je."status" = 'POSTED'
      AND je."entryDate" >= ${from}
      AND je."entryDate" <= ${options.upTo}
      AND a."type" IN ('REVENUE', 'EXPENSE')
      ${brandFilter}
    GROUP BY 1, 2
  `;

  const raw: TrendRawRow[] = rows.map((r) => ({
    ym: r.ym,
    type: r.type === "REVENUE" ? "REVENUE" : "EXPENSE",
    debit: dec(r.debit).toString(),
    credit: dec(r.credit).toString(),
  }));
  return fillTrendMonths(
    raw,
    options.endYear,
    options.endMonth,
    options.months,
  );
}

/** Pendapatan & beban per brand (termasuk baris tanpa tag brand) — agregat DB. */
export async function loadBrandPnl(range: { from: Date; to: Date }) {
  const where = (type: FinanceLedgerType) => ({
    entry: {
      status: FinanceJournalStatus.POSTED,
      entryDate: { gte: range.from, lte: range.to },
    },
    account: { type },
  });

  const [revenueGrouped, expenseGrouped, brands] = await Promise.all([
    prisma.financeJournalLine.groupBy({
      by: ["brandId"],
      where: where(FinanceLedgerType.REVENUE),
      _sum: { debitBase: true, creditBase: true },
    }),
    prisma.financeJournalLine.groupBy({
      by: ["brandId"],
      where: where(FinanceLedgerType.EXPENSE),
      _sum: { debitBase: true, creditBase: true },
    }),
    prisma.brand.findMany({ select: { id: true, name: true } }),
  ]);

  const nameById = new Map(brands.map((b) => [b.id, b.name]));
  const acc = new Map<
    string | null,
    { revenue: Prisma.Decimal; expense: Prisma.Decimal }
  >();
  const slot = (brandId: string | null) => {
    let cur = acc.get(brandId);
    if (!cur) {
      cur = { revenue: D0(), expense: D0() };
      acc.set(brandId, cur);
    }
    return cur;
  };
  for (const g of revenueGrouped) {
    const s = slot(g.brandId);
    s.revenue = s.revenue
      .plus(dec(g._sum.creditBase))
      .minus(dec(g._sum.debitBase));
  }
  for (const g of expenseGrouped) {
    const s = slot(g.brandId);
    s.expense = s.expense
      .plus(dec(g._sum.debitBase))
      .minus(dec(g._sum.creditBase));
  }

  return [...acc.entries()]
    .map(([brandId, v]) => ({
      id: brandId,
      name: brandId
        ? (nameById.get(brandId) ?? "Brand terhapus")
        : "Tanpa brand",
      revenue: v.revenue,
      expense: v.expense,
      net: v.revenue.minus(v.expense),
    }))
    .filter((r) => !r.revenue.isZero() || !r.expense.isZero())
    .sort((a, b) => b.revenue.comparedTo(a.revenue));
}

/**
 * Saldo tiap akun kas/bank (`tracksCashflow`) per `asOf` — jumlahnya sama
 * dengan KPI "Kas & Bank" dashboard (sumber: jurnal terposting).
 */
export async function loadCashPositions(options: {
  asOf: Date;
  brandId: string | null;
}) {
  const [grouped, accounts, bankAccounts] = await Promise.all([
    prisma.financeJournalLine.groupBy({
      by: ["accountId"],
      where: {
        entry: {
          status: FinanceJournalStatus.POSTED,
          entryDate: { lte: options.asOf },
        },
        account: { tracksCashflow: true },
        ...(options.brandId ? { brandId: options.brandId } : {}),
      },
      _sum: { debitBase: true, creditBase: true },
    }),
    prisma.financeLedgerAccount.findMany({
      where: { tracksCashflow: true },
      select: { id: true, code: true, name: true },
      orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
    }),
    prisma.financeBankAccount.findMany({
      select: {
        ledgerAccountId: true,
        name: true,
        institution: true,
        accountMask: true,
      },
      orderBy: { name: "asc" },
    }),
  ]);

  const balanceById = new Map(
    grouped.map((g) => [
      g.accountId,
      dec(g._sum.debitBase).minus(dec(g._sum.creditBase)),
    ]),
  );
  const bankLabelById = new Map<string, string[]>();
  for (const b of bankAccounts) {
    const label = [b.institution, b.name, b.accountMask]
      .filter(Boolean)
      .join(" · ");
    bankLabelById.set(b.ledgerAccountId, [
      ...(bankLabelById.get(b.ledgerAccountId) ?? []),
      label,
    ]);
  }

  return accounts
    .map((a) => ({
      code: a.code,
      name: a.name,
      bankLabel: bankLabelById.get(a.id)?.join("; ") ?? null,
      balance: balanceById.get(a.id) ?? D0(),
    }))
    .filter((a) => !a.balance.isZero() || a.bankLabel != null);
}

/** Dokumen AP & AR yang masih terbuka (OPEN/PARTIAL) beserta sisa tagihannya. */
export async function loadOpenApAr(): Promise<{
  ap: OpenDoc[];
  ar: OpenDoc[];
}> {
  const openStatus = {
    in: [FinanceApArDocStatus.OPEN, FinanceApArDocStatus.PARTIAL],
  };
  const [bills, invoices] = await Promise.all([
    prisma.financeApBill.findMany({
      where: { status: openStatus },
      include: {
        vendor: { select: { name: true } },
        payments: { select: { amount: true } },
      },
    }),
    prisma.financeArInvoice.findMany({
      where: { status: openStatus },
      include: { payments: { select: { amount: true } } },
    }),
  ]);

  const remaining = (
    amount: Prisma.Decimal,
    payments: { amount: Prisma.Decimal }[],
  ) =>
    payments
      .reduce((acc, p) => acc.minus(p.amount), new Prisma.Decimal(amount))
      .toString();

  return {
    ap: bills.map((b) => ({
      name: b.vendorName || b.vendor?.name || "—",
      docNumber: b.billNumber ?? null,
      dueDate: b.dueDate,
      remaining: remaining(b.amount, b.payments),
    })),
    ar: invoices.map((i) => ({
      name: i.customerName,
      docNumber: i.invoiceNumber ?? null,
      dueDate: i.dueDate,
      remaining: remaining(i.amount, i.payments),
    })),
  };
}
