import "server-only";

import {
  FinanceJournalStatus,
  FinanceLedgerType,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { zeroDecimal } from "@/lib/finance-money";

export type CashFlowCategory = "operating" | "investing" | "financing";

export type CashFlowGroup = {
  category: CashFlowCategory;
  label: string;
  inflow: Prisma.Decimal;
  outflow: Prisma.Decimal;
  net: Prisma.Decimal;
  /** Detail per akun lawan (mis. Pendapatan penjualan +Rp 25 jt, HPP -Rp 5 jt). */
  byCounterAccount: {
    accountId: string;
    code: string;
    name: string;
    inflow: Prisma.Decimal;
    outflow: Prisma.Decimal;
    net: Prisma.Decimal;
  }[];
};

export type CashFlowStatement = {
  from: Date;
  to: Date;
  /** Mutasi kas masuk total (sisi debit pada akun tracksCashflow). */
  totalInflow: Prisma.Decimal;
  /** Mutasi kas keluar total (sisi kredit pada akun tracksCashflow). */
  totalOutflow: Prisma.Decimal;
  /** Net kas (inflow − outflow). */
  netCash: Prisma.Decimal;
  groups: CashFlowGroup[];
};

const CATEGORY_LABEL: Record<CashFlowCategory, string> = {
  operating: "Aktivitas operasi",
  investing: "Aktivitas investasi",
  financing: "Aktivitas pendanaan",
};

/**
 * Laporan Arus Kas (Direct method, sederhana).
 *
 * Pendekatan: untuk setiap jurnal yang menyentuh akun **kas/bank**, kita
 * lihat akun **lawan** pada baris-baris jurnal yang sama → klasifikasikan
 * berdasarkan tipe akun lawan:
 *   - REVENUE / EXPENSE  → operasi
 *   - ASSET (non-cash)   → investasi (mis. beli aset tetap)
 *   - LIABILITY / EQUITY → pendanaan (mis. setoran modal, pinjaman)
 *
 * Saldo kas yang naik/turun dialokasikan ke kategori tersebut secara
 * proporsional terhadap akun lawan pada jurnal yang sama. Cocok untuk
 * UMKM/SME — bukan PSAK 2 lengkap, tapi praktis & jelas dibaca.
 */
export async function buildCashFlowStatement(options: {
  from: Date;
  to: Date;
  brandId?: string | null;
}): Promise<CashFlowStatement> {
  const start = startOfDay(options.from);
  const end = endOfDay(options.to);

  const entries = await prisma.financeJournalEntry.findMany({
    where: {
      status: FinanceJournalStatus.POSTED,
      entryDate: { gte: start, lte: end },
      lines: {
        some: {
          account: { tracksCashflow: true },
          ...(options.brandId ? { brandId: options.brandId } : {}),
        },
      },
    },
    select: {
      id: true,
      lines: {
        select: {
          accountId: true,
          debitBase: true,
          creditBase: true,
          brandId: true,
          account: {
            select: {
              id: true,
              code: true,
              name: true,
              type: true,
              tracksCashflow: true,
            },
          },
        },
      },
    },
    orderBy: { entryDate: "asc" },
  });

  type AccBucket = {
    accountId: string;
    code: string;
    name: string;
    inflow: Prisma.Decimal;
    outflow: Prisma.Decimal;
  };

  const buckets: Record<CashFlowCategory, Map<string, AccBucket>> = {
    operating: new Map(),
    investing: new Map(),
    financing: new Map(),
  };

  let totalInflow = zeroDecimal();
  let totalOutflow = zeroDecimal();

  for (const entry of entries) {
    if (options.brandId) {
      // Hanya pertimbangkan baris dengan tag brand bila brand difilter
      const matched = entry.lines.some(
        (l) => l.brandId === options.brandId && l.account.tracksCashflow,
      );
      if (!matched) continue;
    }

    const cashLines = entry.lines.filter(
      (l) =>
        l.account.tracksCashflow &&
        (!options.brandId || l.brandId === options.brandId),
    );
    const counterLines = entry.lines.filter(
      (l) =>
        !l.account.tracksCashflow &&
        (!options.brandId || l.brandId === options.brandId),
    );

    let cashDelta = zeroDecimal();
    for (const c of cashLines) {
      cashDelta = cashDelta.plus(c.debitBase).minus(c.creditBase);
    }
    if (cashDelta.isZero()) continue; // mis. transfer antar bank

    if (cashDelta.gt(0)) totalInflow = totalInflow.plus(cashDelta);
    else totalOutflow = totalOutflow.plus(cashDelta.abs());

    if (counterLines.length === 0) continue;

    let counterMagnitude = zeroDecimal();
    for (const cl of counterLines) {
      const mag = cl.debitBase.plus(cl.creditBase);
      counterMagnitude = counterMagnitude.plus(mag);
    }
    if (counterMagnitude.isZero()) continue;

    for (const cl of counterLines) {
      const mag = cl.debitBase.plus(cl.creditBase);
      if (mag.isZero()) continue;
      const share = cashDelta.mul(mag).dividedBy(counterMagnitude);

      const cat = categoryFor(cl.account.type);
      const bucket = buckets[cat];
      const cur = bucket.get(cl.account.id) ?? {
        accountId: cl.account.id,
        code: cl.account.code,
        name: cl.account.name,
        inflow: zeroDecimal(),
        outflow: zeroDecimal(),
      };
      if (share.gt(0)) cur.inflow = cur.inflow.plus(share);
      else cur.outflow = cur.outflow.plus(share.abs());
      bucket.set(cl.account.id, cur);
    }
  }

  const groups: CashFlowGroup[] = (
    ["operating", "investing", "financing"] as CashFlowCategory[]
  ).map((cat) => {
    const items = [...buckets[cat].values()].sort((a, b) =>
      a.code.localeCompare(b.code),
    );
    let inflow = zeroDecimal();
    let outflow = zeroDecimal();
    const byCounterAccount = items.map((it) => {
      inflow = inflow.plus(it.inflow);
      outflow = outflow.plus(it.outflow);
      return {
        accountId: it.accountId,
        code: it.code,
        name: it.name,
        inflow: it.inflow,
        outflow: it.outflow,
        net: it.inflow.minus(it.outflow),
      };
    });
    return {
      category: cat,
      label: CATEGORY_LABEL[cat],
      inflow,
      outflow,
      net: inflow.minus(outflow),
      byCounterAccount,
    };
  });

  return {
    from: start,
    to: end,
    totalInflow,
    totalOutflow,
    netCash: totalInflow.minus(totalOutflow),
    groups,
  };
}

function categoryFor(t: FinanceLedgerType): CashFlowCategory {
  switch (t) {
    case FinanceLedgerType.REVENUE:
    case FinanceLedgerType.EXPENSE:
      return "operating";
    case FinanceLedgerType.ASSET:
      return "investing";
    case FinanceLedgerType.LIABILITY:
    case FinanceLedgerType.EQUITY:
      return "financing";
  }
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}
