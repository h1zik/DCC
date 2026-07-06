import { Prisma } from "@prisma/client";
import { normalizeNumericString } from "@/lib/numeric-string";

/**
 * Parser CSV rekening koran — dipisah dari server action agar bisa diunit-test.
 * CSV sederhana: kolom tanggal, keterangan, jumlah (positif = masuk).
 * Mendukung pemisah koma atau titik koma; baris pertama boleh berisi header.
 */

export interface BankCsvRow {
  txnDate: Date;
  description: string;
  amount: Prisma.Decimal;
}

export function splitCsvLine(line: string): string[] {
  const delim = line.includes(";") && !line.includes(",") ? ";" : ",";
  return line.split(delim).map((s) => s.trim().replace(/^"|"$/g, ""));
}

export function parseLooseDate(s: string): Date | null {
  const t = s.trim();
  const iso = Date.parse(t);
  if (!Number.isNaN(iso)) return new Date(iso);
  const m = t.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (!m) return null;
  const d = Number(m[1]);
  const mo = Number(m[2]) - 1;
  let y = Number(m[3]);
  if (y < 100) y += 2000;
  const dt = new Date(y, mo, d);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

/**
 * Parse nominal satu sel. Memakai heuristik separator yang sama dengan input
 * nominal lain (`normalizeNumericString`) sehingga "1.234,56" (id-ID),
 * "1,234.56" dan "1234.56" (US) semuanya terbaca benar — parser lama
 * menghapus SEMUA titik sehingga "1234.56" membengkak 100× menjadi 123456.
 */
export function parseBankAmount(s: string): Prisma.Decimal | null {
  const t = s.trim();
  if (!t) return null;
  const normalized = normalizeNumericString(t);
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return null;
  try {
    const d = new Prisma.Decimal(normalized);
    return d.isFinite() ? d : null;
  } catch {
    return null;
  }
}

export function parseFlexibleBankCsv(text: string): BankCsvRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const out: BankCsvRow[] = [];

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const parts = splitCsvLine(raw);
    if (parts.length < 3) continue;
    const [a, b, c] = parts;
    const lower = `${a} ${b} ${c}`.toLowerCase();
    if (
      i === 0 &&
      (lower.includes("tanggal") ||
        lower.includes("date") ||
        lower.includes("description") ||
        lower.includes("amount"))
    ) {
      continue;
    }

    const txnDate = parseLooseDate(a);
    if (!txnDate) continue;
    const description = b.trim();
    const amount = parseBankAmount(c);
    if (!amount) continue;
    out.push({ txnDate, description, amount });
  }

  return out;
}
