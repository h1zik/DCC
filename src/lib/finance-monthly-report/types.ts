/**
 * DTO Laporan Keuangan Bulanan — polos & JSON-serializable (uang = string
 * desimal, tanggal = ISO) supaya modul highlights/charts/html tetap pure dan
 * bisa diuji tanpa Prisma.
 */

export type MonthlyReportInput = {
  year: number;
  /** 1–12 */
  month: number;
  brandId: string | null;
};

/** Nilai bulan ini vs bulan kalender sebelumnya. `deltaPct` null = tak ada pembanding. */
export type MoneyPair = {
  current: string;
  previous: string;
  deltaPct: number | null;
};

export type LedgerTypeName =
  "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE";

export type ProfitLossRow = {
  code: string;
  name: string;
  type: "REVENUE" | "EXPENSE";
  current: string;
  previous: string;
};

export type BalanceSheetLine = { code: string; name: string; amount: string };

export type BalanceSheetSide = {
  assets: BalanceSheetLine[];
  liabilities: BalanceSheetLine[];
  equity: BalanceSheetLine[];
  retainedEarnings: string;
  totalAssets: string;
  totalLiabilities: string;
  totalEquity: string;
  difference: string;
  isBalanced: boolean;
};

export type CashFlowGroupDto = {
  category: "operating" | "investing" | "financing";
  label: string;
  inflow: string;
  outflow: string;
  net: string;
  byCounterAccount: {
    code: string;
    name: string;
    inflow: string;
    outflow: string;
    net: string;
  }[];
};

export type AgingBuckets = {
  current: string;
  d1_30: string;
  d31_60: string;
  over60: string;
};

export type AgingDoc = {
  name: string;
  docNumber: string | null;
  dueDateIso: string;
  remaining: string;
  /** > 0 berarti lewat jatuh tempo. */
  daysOverdue: number;
};

export type AgingSide = {
  total: string;
  count: number;
  overdueCount: number;
  overdueTotal: string;
  buckets: AgingBuckets;
  /** Dokumen terbesar/tertua untuk ditampilkan (maks. 8). */
  top: AgingDoc[];
};

export type TrendPoint = {
  year: number;
  month: number;
  /** Label pendek, mis. "Sep 26". */
  label: string;
  revenue: string;
  expense: string;
  net: string;
};

export type HighlightTone = "positive" | "negative" | "warning" | "info";
export type Highlight = { tone: HighlightTone; text: string };

export type MonthlyReportData = {
  meta: {
    year: number;
    month: number;
    periodLabel: string;
    prevPeriodLabel: string;
    fromIso: string;
    /** Akhir bulan kalender. */
    toIso: string;
    /** Batas data sebenarnya (hari ini bila bulan masih berjalan). */
    effectiveToIso: string;
    isInProgress: boolean;
    generatedAtIso: string;
    generatedByName: string | null;
    brand: { id: string; name: string } | null;
    appName: string;
    logoPath: string | null;
    lock: { lockedAtIso: string; lockedByName: string | null } | null;
    draftJournalCount: number;
    postedJournalCount: number;
  };
  kpis: {
    revenue: MoneyPair;
    expense: MoneyPair;
    net: MoneyPair;
    marginPct: number | null;
    prevMarginPct: number | null;
    cashNet: MoneyPair;
    cashInflow: string;
    cashOutflow: string;
    cashAndBank: string;
  };
  profitLoss: {
    rows: ProfitLossRow[];
    revenue: MoneyPair;
    expense: MoneyPair;
    netIncome: MoneyPair;
  };
  balanceSheet: {
    asOfIso: string;
    previousAsOfIso: string;
    current: BalanceSheetSide;
    previous: BalanceSheetSide;
  };
  cashFlow: {
    totalInflow: string;
    totalOutflow: string;
    netCash: string;
    groups: CashFlowGroupDto[];
  };
  brandPnl: {
    id: string | null;
    name: string;
    revenue: string;
    expense: string;
    net: string;
    marginPct: number | null;
  }[];
  budget: {
    rows: {
      label: string;
      limit: string;
      actual: string;
      variance: string;
      usedPct: number | null;
      over: boolean;
    }[];
    overCount: number;
  };
  aging: { refDateIso: string; ap: AgingSide; ar: AgingSide };
  tax: { code: string; label: string; amount: string }[];
  /** 6 titik, terlama → terbaru; titik terakhir = bulan laporan. */
  trend: TrendPoint[];
  topExpenses: {
    code: string;
    name: string;
    amount: string;
    previous: string;
    sharePct: number;
  }[];
  cashPositions: {
    code: string;
    name: string;
    bankLabel: string | null;
    balance: string;
  }[];
  trialBalance: {
    isBalanced: boolean;
    totals: { debit: string; credit: string };
    rows: {
      code: string;
      name: string;
      type: LedgerTypeName;
      debit: string;
      credit: string;
    }[];
  };
  highlights: Highlight[];
};
