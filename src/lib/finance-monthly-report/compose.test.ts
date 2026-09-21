import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const D = (v: string | number) => new Prisma.Decimal(v);

const mocks = vi.hoisted(() => ({
  reportProfitLoss: vi.fn(),
  reportBalanceSheetComparison: vi.fn(),
  reportTaxBuckets: vi.fn(),
  financeBudgetVsActual: vi.fn(),
  buildCashFlowStatement: vi.fn(),
  buildTrialBalance: vi.fn(),
  loadMonthlyTrend: vi.fn(),
  loadBrandPnl: vi.fn(),
  loadCashPositions: vi.fn(),
  loadOpenApAr: vi.fn(),
  prisma: {
    financePeriodLock: { findUnique: vi.fn() },
    financeJournalEntry: { count: vi.fn() },
    brand: { findUnique: vi.fn() },
    financeLedgerAccount: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/actions/finance-reports", () => ({
  reportProfitLoss: mocks.reportProfitLoss,
  reportBalanceSheetComparison: mocks.reportBalanceSheetComparison,
  reportTaxBuckets: mocks.reportTaxBuckets,
}));
vi.mock("@/actions/finance-budget", () => ({
  financeBudgetVsActual: mocks.financeBudgetVsActual,
}));
vi.mock("@/lib/finance-cashflow", () => ({
  buildCashFlowStatement: mocks.buildCashFlowStatement,
}));
vi.mock("@/lib/finance-trial-balance", () => ({
  buildTrialBalance: mocks.buildTrialBalance,
}));
vi.mock("@/lib/app-branding", () => ({
  getAppBranding: vi.fn(async () => ({ appName: "DCC", logoImagePath: null })),
}));
vi.mock("./queries", () => ({
  loadMonthlyTrend: mocks.loadMonthlyTrend,
  loadBrandPnl: mocks.loadBrandPnl,
  loadCashPositions: mocks.loadCashPositions,
  loadOpenApAr: mocks.loadOpenApAr,
}));

import { composeMonthlyFinanceReport } from "./compose";

const bsSide = {
  assets: [{ code: "1100", name: "Kas", type: "ASSET", amount: D(500) }],
  liabilities: [],
  equity: [{ code: "3000", name: "Modal", type: "EQUITY", amount: D(200) }],
  retainedEarnings: D(300),
  totalAssets: D(500),
  totalLiabilities: D(0),
  totalEquity: D(500),
  difference: D(0),
  isBalanced: true,
};
const cashFlow = (net: number) => ({
  from: new Date(0),
  to: new Date(0),
  totalInflow: D(Math.max(net, 0)),
  totalOutflow: D(Math.max(-net, 0)),
  netCash: D(net),
  groups: [],
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.reportProfitLoss.mockImplementation(async ({ from }: { from: Date }) =>
    from.getUTCMonth() === 8
      ? {
          rows: [
            {
              code: "4000",
              name: "Penjualan",
              type: "REVENUE",
              amount: D(1000),
            },
            { code: "6100", name: "Gaji", type: "EXPENSE", amount: D(600) },
            { code: "6900", name: "Koreksi", type: "EXPENSE", amount: D(0) },
          ],
          revenue: D(1000),
          expense: D(600),
          netIncome: D(400),
        }
      : {
          rows: [
            {
              code: "4000",
              name: "Penjualan",
              type: "REVENUE",
              amount: D(800),
            },
            { code: "6200", name: "Iklan", type: "EXPENSE", amount: D(500) },
          ],
          revenue: D(800),
          expense: D(500),
          netIncome: D(300),
        },
  );
  mocks.reportBalanceSheetComparison.mockImplementation(
    async ({ asOf }: { asOf: Date }) => ({
      asOf,
      previousAsOf: new Date("2026-08-31T23:59:59.999Z"),
      current: bsSide,
      previous: bsSide,
    }),
  );
  mocks.reportTaxBuckets.mockResolvedValue({
    rows: [{ code: "2100", label: "Utang PPN", amount: D(10) }],
  });
  mocks.financeBudgetVsActual.mockResolvedValue([
    {
      budgetId: "b1",
      label: "6100 · Semua brand",
      limit: D(500),
      actual: D(600),
      variance: D(-100),
    },
    {
      budgetId: "b2",
      label: "SEMUA_BEBAN · Aurora",
      limit: D(0),
      actual: D(0),
      variance: D(0),
    },
  ]);
  mocks.buildCashFlowStatement.mockImplementation(
    async ({ from }: { from: Date }) =>
      cashFlow(from.getUTCMonth() === 8 ? 250 : -50),
  );
  mocks.buildTrialBalance.mockResolvedValue({
    rows: [],
    totals: { debit: D(0), credit: D(0) },
    isBalanced: true,
    asOf: new Date(0),
  });
  mocks.loadMonthlyTrend.mockResolvedValue([]);
  mocks.loadBrandPnl.mockResolvedValue([
    {
      id: "b1",
      name: "Aurora",
      revenue: D(1000),
      expense: D(600),
      net: D(400),
    },
  ]);
  mocks.loadCashPositions.mockResolvedValue([
    { code: "1100", name: "Kas", bankLabel: null, balance: D(300) },
    { code: "1110", name: "Bank", bankLabel: "BCA", balance: D(200) },
  ]);
  mocks.loadOpenApAr.mockResolvedValue({ ap: [], ar: [] });
  mocks.prisma.financePeriodLock.findUnique.mockResolvedValue(null);
  mocks.prisma.financeJournalEntry.count.mockResolvedValue(4);
  mocks.prisma.brand.findUnique.mockResolvedValue({ id: "b1", name: "Aurora" });
  mocks.prisma.financeLedgerAccount.findMany.mockResolvedValue([
    { code: "6100", name: "Gaji" },
  ]);
});

const closedMonth = {
  generatedByName: "Rina",
  now: new Date("2026-10-10T03:00:00.000Z"),
};

describe("composeMonthlyFinanceReport", () => {
  it("membandingkan dengan BULAN KALENDER sebelumnya (bukan geser panjang periode)", async () => {
    await composeMonthlyFinanceReport(
      { year: 2026, month: 9, brandId: null },
      closedMonth,
    );
    const ranges = mocks.reportProfitLoss.mock.calls.map(([q]) => [
      q.from.toISOString(),
      q.to.toISOString(),
    ]);
    expect(ranges).toContainEqual([
      "2026-09-01T00:00:00.000Z",
      "2026-09-30T23:59:59.999Z",
    ]);
    expect(ranges).toContainEqual([
      "2026-08-01T00:00:00.000Z",
      "2026-08-31T23:59:59.999Z",
    ]);
  });

  it("KPI = total laporan, baris L/R digabung, DTO polos JSON", async () => {
    const d = await composeMonthlyFinanceReport(
      { year: 2026, month: 9, brandId: null },
      closedMonth,
    );
    expect(d.kpis.revenue).toEqual(d.profitLoss.revenue);
    expect(d.kpis.revenue).toMatchObject({ current: "1000", previous: "800" });
    expect(d.kpis.revenue.deltaPct).toBeCloseTo(25);
    expect(d.kpis.marginPct).toBeCloseTo(40);
    expect(d.kpis.cashNet).toMatchObject({ current: "250", previous: "-50" });
    expect(d.kpis.cashAndBank).toBe("500");

    // Akun hanya-bulan-lalu ikut tampil; akun nol di kedua bulan dibuang.
    expect(
      d.profitLoss.rows.map((r) => [r.code, r.current, r.previous]),
    ).toEqual([
      ["4000", "1000", "800"],
      ["6100", "600", "0"],
      ["6200", "0", "500"],
    ]);
    expect(d.topExpenses).toEqual([
      expect.objectContaining({ code: "6100", amount: "600", sharePct: 100 }),
    ]);

    expect(d.budget.rows[0]).toMatchObject({
      label: "6100 Gaji · Semua brand",
      over: true,
      usedPct: 120,
    });
    expect(d.budget.rows[1]).toMatchObject({
      label: "Semua beban · Aurora",
      usedPct: null,
      over: false,
    });
    expect(d.budget.overCount).toBe(1);

    expect(d.meta).toMatchObject({
      periodLabel: "September 2026",
      prevPeriodLabel: "Agustus 2026",
      isInProgress: false,
      lock: null,
      generatedByName: "Rina",
    });
    expect(JSON.parse(JSON.stringify(d))).toEqual(d);
    expect(d.highlights.length).toBeGreaterThan(0);
  });

  it("bulan berjalan: data dipotong di hari ini (kalender Jakarta)", async () => {
    const d = await composeMonthlyFinanceReport(
      { year: 2026, month: 9, brandId: null },
      // 20 Sep 18:30 UTC = 21 Sep 01:30 WIB
      { generatedByName: null, now: new Date("2026-09-20T18:30:00.000Z") },
    );
    expect(d.meta.isInProgress).toBe(true);
    expect(d.meta.effectiveToIso).toBe("2026-09-21T23:59:59.999Z");
    // Builder ber-setHours lokal menerima tanggal murni.
    const cfTo = mocks.buildCashFlowStatement.mock.calls[0][0].to as Date;
    expect(cfTo.toISOString()).toBe("2026-09-21T00:00:00.000Z");
    expect(mocks.buildTrialBalance.mock.calls[0][0].asOf.toISOString()).toBe(
      "2026-09-21T00:00:00.000Z",
    );
  });

  it("filter brand diteruskan & L/R per brand dilewati", async () => {
    const d = await composeMonthlyFinanceReport(
      { year: 2026, month: 9, brandId: "b1" },
      closedMonth,
    );
    expect(mocks.loadBrandPnl).not.toHaveBeenCalled();
    expect(d.brandPnl).toEqual([]);
    expect(d.meta.brand).toEqual({ id: "b1", name: "Aurora" });
    for (const [q] of mocks.reportProfitLoss.mock.calls)
      expect(q.brandId).toBe("b1");
    expect(mocks.loadMonthlyTrend.mock.calls[0][0].brandId).toBe("b1");
  });

  it("periode terkunci → info kunci ikut terbawa", async () => {
    mocks.prisma.financePeriodLock.findUnique.mockResolvedValue({
      lockedAt: new Date("2026-10-02T09:00:00.000Z"),
      lockedBy: { name: "Rina" },
    });
    const d = await composeMonthlyFinanceReport(
      { year: 2026, month: 9, brandId: null },
      closedMonth,
    );
    expect(d.meta.lock).toEqual({
      lockedAtIso: "2026-10-02T09:00:00.000Z",
      lockedByName: "Rina",
    });
  });
});
