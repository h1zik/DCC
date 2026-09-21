import { bucketAging } from "./aging";
import { pctChange } from "./format";
import { buildMonthlyHighlights } from "./highlights";
import { fillTrendMonths } from "./trend";
import type { BalanceSheetSide, MoneyPair, MonthlyReportData } from "./types";

/** Data contoh untuk unit test & pratinjau template (bukan data produksi). */

const pair = (current: string, previous: string): MoneyPair => ({
  current,
  previous,
  deltaPct: pctChange(current, previous),
});

const bsSide = (scale: number): BalanceSheetSide => {
  const v = (n: number) => String(Math.round(n * scale));
  return {
    assets: [
      { code: "1100", name: "Kas", amount: v(18_500_000) },
      { code: "1110", name: "Bank BCA", amount: v(245_300_000) },
      { code: "1200", name: "Piutang usaha", amount: v(96_400_000) },
      { code: "1300", name: "Persediaan", amount: v(132_000_000) },
      { code: "1500", name: "Aset tetap", amount: v(210_000_000) },
    ],
    liabilities: [
      { code: "2000", name: "Hutang usaha", amount: v(84_200_000) },
      { code: "2100", name: "Utang PPN", amount: v(12_800_000) },
    ],
    equity: [{ code: "3000", name: "Modal disetor", amount: v(400_000_000) }],
    retainedEarnings: v(205_200_000),
    totalAssets: v(702_200_000),
    totalLiabilities: v(97_000_000),
    totalEquity: v(605_200_000),
    difference: "0",
    isBalanced: true,
  };
};

export function makeReportData(
  overrides: Partial<Omit<MonthlyReportData, "highlights">> = {},
): MonthlyReportData {
  const refDate = new Date("2026-10-03T00:00:00.000Z");
  const base: Omit<MonthlyReportData, "highlights"> = {
    meta: {
      year: 2026,
      month: 9,
      periodLabel: "September 2026",
      prevPeriodLabel: "Agustus 2026",
      fromIso: "2026-09-01T00:00:00.000Z",
      toIso: "2026-09-30T23:59:59.999Z",
      effectiveToIso: "2026-09-30T23:59:59.999Z",
      isInProgress: false,
      generatedAtIso: "2026-10-03T02:15:00.000Z",
      generatedByName: "Rina Finance",
      brand: null,
      appName: "Dominatus Control Center",
      logoPath: null,
      lock: {
        lockedAtIso: "2026-10-02T09:00:00.000Z",
        lockedByName: "Rina Finance",
      },
      draftJournalCount: 0,
      postedJournalCount: 142,
    },
    kpis: {
      revenue: pair("486500000", "432800000"),
      expense: pair("371200000", "352100000"),
      net: pair("115300000", "80700000"),
      marginPct: 23.7,
      prevMarginPct: 18.6,
      cashNet: pair("64200000", "-12500000"),
      cashInflow: "455000000",
      cashOutflow: "390800000",
      cashAndBank: "263800000",
    },
    profitLoss: {
      rows: [
        {
          code: "4000",
          name: "Penjualan produk",
          type: "REVENUE",
          current: "452000000",
          previous: "401300000",
        },
        {
          code: "4100",
          name: "Pendapatan jasa",
          type: "REVENUE",
          current: "34500000",
          previous: "31500000",
        },
        {
          code: "5000",
          name: "Harga pokok penjualan",
          type: "EXPENSE",
          current: "198400000",
          previous: "187600000",
        },
        {
          code: "6100",
          name: "Gaji & tunjangan",
          type: "EXPENSE",
          current: "86000000",
          previous: "86000000",
        },
        {
          code: "6200",
          name: "Iklan & promosi",
          type: "EXPENSE",
          current: "52300000",
          previous: "41200000",
        },
        {
          code: "6300",
          name: "Sewa & utilitas",
          type: "EXPENSE",
          current: "21500000",
          previous: "21500000",
        },
        {
          code: "6400",
          name: "Logistik & pengiriman",
          type: "EXPENSE",
          current: "13000000",
          previous: "15800000",
        },
      ],
      revenue: pair("486500000", "432800000"),
      expense: pair("371200000", "352100000"),
      netIncome: pair("115300000", "80700000"),
    },
    balanceSheet: {
      asOfIso: "2026-09-30T23:59:59.999Z",
      previousAsOfIso: "2026-08-31T23:59:59.999Z",
      current: bsSide(1),
      previous: bsSide(0.9),
    },
    cashFlow: {
      totalInflow: "455000000",
      totalOutflow: "390800000",
      netCash: "64200000",
      groups: [
        {
          category: "operating",
          label: "Aktivitas operasi",
          inflow: "455000000",
          outflow: "350800000",
          net: "104200000",
          byCounterAccount: [
            {
              code: "4000",
              name: "Penjualan produk",
              inflow: "455000000",
              outflow: "0",
              net: "455000000",
            },
            {
              code: "5000",
              name: "Harga pokok penjualan",
              inflow: "0",
              outflow: "198400000",
              net: "-198400000",
            },
            {
              code: "6100",
              name: "Gaji & tunjangan",
              inflow: "0",
              outflow: "86000000",
              net: "-86000000",
            },
          ],
        },
        {
          category: "investing",
          label: "Aktivitas investasi",
          inflow: "0",
          outflow: "40000000",
          net: "-40000000",
          byCounterAccount: [
            {
              code: "1500",
              name: "Aset tetap",
              inflow: "0",
              outflow: "40000000",
              net: "-40000000",
            },
          ],
        },
        {
          category: "financing",
          label: "Aktivitas pendanaan",
          inflow: "0",
          outflow: "0",
          net: "0",
          byCounterAccount: [],
        },
      ],
    },
    brandPnl: [
      {
        id: "b1",
        name: "Aurora Skin",
        revenue: "268000000",
        expense: "189000000",
        net: "79000000",
        marginPct: 29.5,
      },
      {
        id: "b2",
        name: "Terra Home",
        revenue: "164500000",
        expense: "131200000",
        net: "33300000",
        marginPct: 20.2,
      },
      {
        id: null,
        name: "Tanpa brand",
        revenue: "54000000",
        expense: "51000000",
        net: "3000000",
        marginPct: 5.6,
      },
    ],
    budget: {
      rows: [
        {
          label: "6200 Iklan & promosi · Aurora Skin",
          limit: "40000000",
          actual: "52300000",
          variance: "-12300000",
          usedPct: 130.8,
          over: true,
        },
        {
          label: "6100 Gaji & tunjangan · Semua brand",
          limit: "90000000",
          actual: "86000000",
          variance: "4000000",
          usedPct: 95.6,
          over: false,
        },
        {
          label: "6400 Logistik & pengiriman · Semua brand",
          limit: "20000000",
          actual: "13000000",
          variance: "7000000",
          usedPct: 65,
          over: false,
        },
      ],
      overCount: 1,
    },
    aging: {
      refDateIso: refDate.toISOString(),
      ar: bucketAging(
        [
          {
            name: "PT Sinar Retail",
            docNumber: "INV-0921",
            dueDate: new Date("2026-09-10T00:00:00.000Z"),
            remaining: "38400000",
          },
          {
            name: "CV Maju Bersama",
            docNumber: "INV-0934",
            dueDate: new Date("2026-10-15T00:00:00.000Z"),
            remaining: "58000000",
          },
        ],
        refDate,
      ),
      ap: bucketAging(
        [
          {
            name: "PT Kemasan Prima",
            docNumber: "BILL-311",
            dueDate: new Date("2026-10-20T00:00:00.000Z"),
            remaining: "84200000",
          },
        ],
        refDate,
      ),
    },
    tax: [
      { code: "2100", label: "Utang PPN (mutasi periode)", amount: "12800000" },
      { code: "2200", label: "Utang PPh (mutasi periode)", amount: "3100000" },
    ],
    trend: fillTrendMonths(
      [
        { ym: "2026-04", type: "REVENUE", debit: "0", credit: "350000000" },
        { ym: "2026-04", type: "EXPENSE", debit: "310000000", credit: "0" },
        { ym: "2026-05", type: "REVENUE", debit: "0", credit: "372000000" },
        { ym: "2026-05", type: "EXPENSE", debit: "331000000", credit: "0" },
        { ym: "2026-06", type: "REVENUE", debit: "0", credit: "341000000" },
        { ym: "2026-06", type: "EXPENSE", debit: "356000000", credit: "0" },
        { ym: "2026-07", type: "REVENUE", debit: "0", credit: "405000000" },
        { ym: "2026-07", type: "EXPENSE", debit: "344000000", credit: "0" },
        { ym: "2026-08", type: "REVENUE", debit: "0", credit: "432800000" },
        { ym: "2026-08", type: "EXPENSE", debit: "352100000", credit: "0" },
        { ym: "2026-09", type: "REVENUE", debit: "0", credit: "486500000" },
        { ym: "2026-09", type: "EXPENSE", debit: "371200000", credit: "0" },
      ],
      2026,
      9,
      6,
    ),
    topExpenses: [
      {
        code: "5000",
        name: "Harga pokok penjualan",
        amount: "198400000",
        previous: "187600000",
        sharePct: 53.4,
      },
      {
        code: "6100",
        name: "Gaji & tunjangan",
        amount: "86000000",
        previous: "86000000",
        sharePct: 23.2,
      },
      {
        code: "6200",
        name: "Iklan & promosi",
        amount: "52300000",
        previous: "41200000",
        sharePct: 14.1,
      },
      {
        code: "6300",
        name: "Sewa & utilitas",
        amount: "21500000",
        previous: "21500000",
        sharePct: 5.8,
      },
      {
        code: "6400",
        name: "Logistik & pengiriman",
        amount: "13000000",
        previous: "15800000",
        sharePct: 3.5,
      },
    ],
    cashPositions: [
      { code: "1100", name: "Kas", bankLabel: null, balance: "18500000" },
      {
        code: "1110",
        name: "Bank BCA",
        bankLabel: "BCA · Operasional · ••4821",
        balance: "245300000",
      },
    ],
    trialBalance: {
      isBalanced: true,
      totals: { debit: "1073400000", credit: "1073400000" },
      rows: [
        {
          code: "1100",
          name: "Kas",
          type: "ASSET",
          debit: "18500000",
          credit: "0",
        },
        {
          code: "1110",
          name: "Bank BCA",
          type: "ASSET",
          debit: "245300000",
          credit: "0",
        },
        {
          code: "2000",
          name: "Hutang usaha",
          type: "LIABILITY",
          debit: "0",
          credit: "84200000",
        },
        {
          code: "3000",
          name: "Modal disetor",
          type: "EQUITY",
          debit: "0",
          credit: "400000000",
        },
        {
          code: "4000",
          name: "Penjualan produk",
          type: "REVENUE",
          debit: "0",
          credit: "452000000",
        },
        {
          code: "5000",
          name: "Harga pokok penjualan",
          type: "EXPENSE",
          debit: "198400000",
          credit: "0",
        },
      ],
    },
  };

  const merged = { ...base, ...overrides };
  return { ...merged, highlights: buildMonthlyHighlights(merged) };
}
