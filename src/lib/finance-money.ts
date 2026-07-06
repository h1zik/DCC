import { FinanceLedgerType, Prisma } from "@prisma/client";
import { z } from "zod";
import { normalizeNumericString } from "@/lib/numeric-string";

export const FINANCE_BASE_CURRENCY = "IDR";

/**
 * Parse input nominal ke `Prisma.Decimal`.
 *
 * Menolak nilai non-finite (`NaN`, `Infinity`) dan string yang tidak bisa
 * di-parse. Ini penting: decimal.js MENERIMA string "NaN" sebagai nilai
 * valid, dan semua perbandingan terhadap NaN (`gt`, `lte`, dst.) selalu
 * false — sehingga NaN yang lolos akan menembus semua guard nominal
 * (mis. cek "melebihi sisa hutang") dan meracuni agregat laporan.
 */
export function toDecimal(value: string | number): Prisma.Decimal {
  let dec: Prisma.Decimal;
  try {
    dec =
      typeof value === "number"
        ? new Prisma.Decimal(value)
        : new Prisma.Decimal(normalizeNumericString(value) || "0");
  } catch {
    throw new Error(`Nominal tidak valid: "${value}".`);
  }
  if (!dec.isFinite()) {
    throw new Error(`Nominal tidak valid: "${value}".`);
  }
  return dec;
}

function parsesToDecimal(s: string, check: (d: Prisma.Decimal) => boolean) {
  try {
    return check(toDecimal(s));
  } catch {
    return false;
  }
}

/** Skema zod untuk nominal uang yang wajib > 0 (harga, tagihan, pembayaran). */
export const positiveMoneyString = z
  .string()
  .min(1)
  .refine((s) => parsesToDecimal(s, (d) => d.gt(0)), {
    message: "Nominal harus berupa angka lebih dari 0.",
  });

/** Skema zod untuk nominal uang yang boleh 0 tetapi tidak negatif. */
export const nonNegativeMoneyString = z
  .string()
  .min(1)
  .refine((s) => parsesToDecimal(s, (d) => d.gte(0)), {
    message: "Nominal harus berupa angka dan tidak boleh negatif.",
  });

export { normalizeNumericString };

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
