import { FinanceLedgerType, Prisma } from "@prisma/client";

export const FINANCE_BASE_CURRENCY = "IDR";

export function toDecimal(value: string | number): Prisma.Decimal {
  if (typeof value === "number") {
    return new Prisma.Decimal(value);
  }
  const normalized = normalizeNumericString(value);
  return new Prisma.Decimal(normalized || "0");
}

/**
 * Menerima format angka umum:
 * - 18000000
 * - 18.000.000
 * - 18,000,000
 * - 18000000.50
 * - 18.000.000,50
 */
function normalizeNumericString(raw: string): string {
  const s = raw.trim().replace(/\s/g, "");
  if (!s) return "0";

  const hasDot = s.includes(".");
  const hasComma = s.includes(",");

  // Kedua separator ada -> separator terakhir dianggap desimal.
  if (hasDot && hasComma) {
    const lastDot = s.lastIndexOf(".");
    const lastComma = s.lastIndexOf(",");
    if (lastDot > lastComma) {
      // 18,000,000.50
      return s.replace(/,/g, "");
    }
    // 18.000.000,50
    return s.replace(/\./g, "").replace(",", ".");
  }

  // Hanya koma.
  if (hasComma) {
    const commaCount = (s.match(/,/g) ?? []).length;
    if (commaCount > 1) {
      // 18,000,000
      return s.replace(/,/g, "");
    }
    const [left, right = ""] = s.split(",");
    if (right.length === 0) return left;
    // 12,5 / 12,50 -> desimal
    if (right.length <= 2) return `${left}.${right}`;
    // 18,000 -> grouping
    return `${left}${right}`;
  }

  // Hanya titik.
  if (hasDot) {
    const dotCount = (s.match(/\./g) ?? []).length;
    if (dotCount > 1) {
      // 18.000.000
      return s.replace(/\./g, "");
    }
    const [left, right = ""] = s.split(".");
    if (right.length === 0) return left;
    // 12.5 / 12.50 -> desimal
    if (right.length <= 2) return `${left}.${right}`;
    // 18.000 -> grouping
    return `${left}${right}`;
  }

  return s;
}

export function zeroDecimal(): Prisma.Decimal {
  return new Prisma.Decimal(0);
}

/** Saldo bertanda: positif = sesuai sifat akun (aktiva debit, utang kredit, dll.) */
export function signedBalanceForAccount(
  type: FinanceLedgerType,
  debit: Prisma.Decimal,
  credit: Prisma.Decimal,
): Prisma.Decimal {
  const d = debit.minus(credit);
  switch (type) {
    case FinanceLedgerType.ASSET:
    case FinanceLedgerType.EXPENSE:
      return d;
    case FinanceLedgerType.LIABILITY:
    case FinanceLedgerType.EQUITY:
    case FinanceLedgerType.REVENUE:
      return credit.minus(debit);
    default:
      return d;
  }
}

export function formatIdr(value: Prisma.Decimal | null | undefined): string {
  if (value == null) return "—";
  const n = Number(value.toString());
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);
}

export function parseMoneyInput(raw: string): Prisma.Decimal {
  return toDecimal(raw);
}
