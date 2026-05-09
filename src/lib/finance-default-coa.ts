import { FinanceLedgerType, Prisma } from "@prisma/client";

export type DefaultCoaRow = {
  code: string;
  name: string;
  type: FinanceLedgerType;
  sortOrder: number;
  tracksCashflow: boolean;
  isApControl?: boolean;
  isArControl?: boolean;
};

/** Carta dasar IDR — dapat diedit setelah data masuk. */
export const DEFAULT_COA: DefaultCoaRow[] = [
  { code: "1000", name: "Kas", type: FinanceLedgerType.ASSET, sortOrder: 10, tracksCashflow: true },
  { code: "1010", name: "Kas kecil", type: FinanceLedgerType.ASSET, sortOrder: 20, tracksCashflow: true },
  { code: "1100", name: "Bank", type: FinanceLedgerType.ASSET, sortOrder: 30, tracksCashflow: true },
  { code: "1200", name: "Piutang usaha", type: FinanceLedgerType.ASSET, sortOrder: 40, tracksCashflow: false, isArControl: true },
  { code: "1300", name: "Persediaan", type: FinanceLedgerType.ASSET, sortOrder: 50, tracksCashflow: false },
  { code: "1500", name: "Aset tetap (bruto)", type: FinanceLedgerType.ASSET, sortOrder: 60, tracksCashflow: false },
  { code: "1510", name: "Akumulasi penyusutan", type: FinanceLedgerType.ASSET, sortOrder: 70, tracksCashflow: false },
  { code: "2000", name: "Hutang usaha", type: FinanceLedgerType.LIABILITY, sortOrder: 100, tracksCashflow: false, isApControl: true },
  { code: "2100", name: "Utang PPN keluaran", type: FinanceLedgerType.LIABILITY, sortOrder: 110, tracksCashflow: false },
  { code: "2200", name: "Utang PPh pasal 21/23", type: FinanceLedgerType.LIABILITY, sortOrder: 120, tracksCashflow: false },
  { code: "3000", name: "Modal pemilik", type: FinanceLedgerType.EQUITY, sortOrder: 200, tracksCashflow: false },
  { code: "3100", name: "Laba ditahan", type: FinanceLedgerType.EQUITY, sortOrder: 210, tracksCashflow: false },
  { code: "4000", name: "Pendapatan penjualan", type: FinanceLedgerType.REVENUE, sortOrder: 300, tracksCashflow: false },
  { code: "4100", name: "Pendapatan lain-lain", type: FinanceLedgerType.REVENUE, sortOrder: 310, tracksCashflow: false },
  { code: "5000", name: "Harga pokok penjualan (HPP)", type: FinanceLedgerType.EXPENSE, sortOrder: 400, tracksCashflow: false },
  { code: "6000", name: "Beban umum & administrasi", type: FinanceLedgerType.EXPENSE, sortOrder: 500, tracksCashflow: false },
  { code: "6100", name: "Beban pemasaran & iklan", type: FinanceLedgerType.EXPENSE, sortOrder: 510, tracksCashflow: false },
  { code: "6200", name: "Beban penyusutan", type: FinanceLedgerType.EXPENSE, sortOrder: 520, tracksCashflow: false },
];

export function defaultCoaCreateMany(): Prisma.FinanceLedgerAccountCreateManyInput[] {
  return DEFAULT_COA.map((row) => ({
    code: row.code,
    name: row.name,
    type: row.type,
    sortOrder: row.sortOrder,
    tracksCashflow: row.tracksCashflow,
    isActive: true,
    isApControl: row.isApControl ?? false,
    isArControl: row.isArControl ?? false,
  }));
}
