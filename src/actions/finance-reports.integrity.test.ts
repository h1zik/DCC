import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Integritas lapisan laporan: dari SATU set jurnal seimbang, neraca saldo,
 * laba rugi, dan neraca harus saling cocok. Dulu fungsi-fungsi ini tidak
 * punya test sama sekali (di compose.test semuanya di-mock).
 *
 * Prisma dipalsukan dengan penyimpanan in-memory yang menghormati filter
 * `account.type.in` — cukup untuk menguji logika agregasi, bukan SQL-nya.
 */

type Acc = { id: string; code: string; name: string; type: string; sortOrder: number };
type Line = { accountId: string; debitBase: unknown; creditBase: unknown; brandId: null };

const store = vi.hoisted(() => ({ accounts: [] as Acc[], lines: [] as Line[] }));

const mocks = vi.hoisted(() => ({
  prisma: {
    financeLedgerAccount: { findMany: vi.fn() },
    financeJournalLine: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/auth-helpers", () => ({
  requireFinance: vi.fn(async () => ({ user: { id: "finance-1" } })),
}));

import { Prisma } from "@prisma/client";
import {
  reportBalanceSheet,
  reportProfitLoss,
  reportTrialBalance,
} from "./finance-reports";

const D = (v: string | number) => new Prisma.Decimal(v);

const ACCOUNTS: Acc[] = [
  { id: "bank", code: "1100", name: "Bank", type: "ASSET", sortOrder: 30 },
  { id: "ar", code: "1200", name: "Piutang usaha", type: "ASSET", sortOrder: 40 },
  { id: "fa", code: "1500", name: "Aset tetap", type: "ASSET", sortOrder: 60 },
  { id: "accum", code: "1510", name: "Akumulasi penyusutan", type: "ASSET", sortOrder: 70 },
  { id: "ap", code: "2000", name: "Hutang usaha", type: "LIABILITY", sortOrder: 100 },
  { id: "equity", code: "3000", name: "Modal pemilik", type: "EQUITY", sortOrder: 200 },
  { id: "rev", code: "4000", name: "Pendapatan", type: "REVENUE", sortOrder: 300 },
  { id: "opex", code: "6000", name: "Beban umum", type: "EXPENSE", sortOrder: 500 },
  { id: "dep", code: "6200", name: "Beban penyusutan", type: "EXPENSE", sortOrder: 520 },
  { id: "idle", code: "6100", name: "Beban pemasaran", type: "EXPENSE", sortOrder: 510 },
];

/** Tiap entri = [akun debit, akun kredit, nominal] → dua baris seimbang. */
const JOURNALS: [string, string, string][] = [
  ["bank", "equity", "100000000"], // setoran modal
  ["fa", "bank", "48000000"], // beli aset
  ["ar", "rev", "30000000.55"], // penjualan kredit (dengan sen)
  ["bank", "ar", "10000000"], // terima sebagian piutang
  ["opex", "ap", "7500000.45"], // tagihan beban
  ["ap", "bank", "2500000"], // bayar sebagian hutang
  ["dep", "accum", "1000000"], // penyusutan
];

beforeEach(() => {
  vi.clearAllMocks();
  store.accounts = ACCOUNTS;
  store.lines = JOURNALS.flatMap(([dr, cr, amt]) => [
    { accountId: dr, debitBase: D(amt), creditBase: D(0), brandId: null },
    { accountId: cr, debitBase: D(0), creditBase: D(amt), brandId: null },
  ]);

  mocks.prisma.financeLedgerAccount.findMany.mockImplementation(async () =>
    [...store.accounts].sort((a, b) => a.sortOrder - b.sortOrder),
  );
  mocks.prisma.financeJournalLine.findMany.mockImplementation(
    async (args: { where?: { account?: { type?: { in?: string[] } } } }) => {
      const types = args.where?.account?.type?.in;
      return store.lines
        .map((l) => ({ ...l, account: store.accounts.find((a) => a.id === l.accountId)! }))
        .filter((l) => !types || types.includes(l.account.type));
    },
  );
});

const asOf = new Date("2026-06-30T00:00:00Z");

describe("integritas laporan keuangan", () => {
  it("neraca saldo seimbang dan subtotal per tipe = total", async () => {
    const tb = await reportTrialBalance({ asOf, hideZero: true });

    expect(tb.isBalanced).toBe(true);
    expect(tb.totals.debit.toFixed(2)).toBe(tb.totals.credit.toFixed(2));

    const subs = Object.values(tb.subtotalsByType);
    const subDebit = subs.reduce((s, x) => s.plus(x!.debit), D(0));
    const subCredit = subs.reduce((s, x) => s.plus(x!.credit), D(0));
    expect(subDebit.toFixed(2)).toBe(tb.totals.debit.toFixed(2));
    expect(subCredit.toFixed(2)).toBe(tb.totals.credit.toFixed(2));
  });

  it("hideZero membuang akun tanpa mutasi; akun kontra tampil di sisi kredit", async () => {
    const tb = await reportTrialBalance({ asOf, hideZero: true });
    expect(tb.rows.find((r) => r.code === "6100")).toBeUndefined();

    const accum = tb.rows.find((r) => r.code === "1510")!;
    expect(accum.debit.toFixed(2)).toBe("0.00");
    expect(accum.credit.toFixed(2)).toBe("1000000.00");
  });

  it("laba rugi: pendapatan − beban, sen tidak hilang", async () => {
    const pl = await reportProfitLoss({ from: new Date("2026-01-01"), to: asOf });
    expect(pl.revenue.toFixed(2)).toBe("30000000.55");
    expect(pl.expense.toFixed(2)).toBe("8500000.45");
    expect(pl.netIncome.toFixed(2)).toBe("21500000.10");
  });

  it("neraca: aset = liabilitas + ekuitas + laba berjalan, selisih tepat nol", async () => {
    const bs = await reportBalanceSheet(asOf);
    expect(bs.isBalanced).toBe(true);
    expect(bs.difference.toFixed(2)).toBe("0.00");
    expect(bs.retainedEarnings.toFixed(2)).toBe("21500000.10");
    // bank 59.5jt + piutang 20.000.000,55 + aset 48jt − akumulasi 1jt
    expect(bs.totalAssets.toFixed(2)).toBe("126500000.55");
    expect(bs.totalLiabilities.toFixed(2)).toBe("5000000.45");
  });

  it("laba bersih L/R = laba berjalan di neraca (satu sumber angka)", async () => {
    const pl = await reportProfitLoss({ from: new Date(0), to: asOf });
    const bs = await reportBalanceSheet(asOf);
    expect(bs.retainedEarnings.toFixed(2)).toBe(pl.netIncome.toFixed(2));
  });

  it("jurnal tidak seimbang terdeteksi oleh neraca saldo dan neraca", async () => {
    store.lines.push({ accountId: "bank", debitBase: D("0.01"), creditBase: D(0), brandId: null });
    const tb = await reportTrialBalance({ asOf, hideZero: true });
    const bs = await reportBalanceSheet(asOf);
    expect(tb.isBalanced).toBe(false);
    expect(bs.isBalanced).toBe(false);
    expect(bs.difference.toFixed(2)).toBe("0.01");
  });
});
