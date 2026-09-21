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

/** Tanggal murni UTC; null bila komponennya bukan tanggal kalender yang sah (mis. 31/02). */
function utcDateFromParts(y: number, mo: number, d: number): Date | null {
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== mo - 1 ||
    dt.getUTCDate() !== d
  ) {
    return null;
  }
  return dt;
}

/**
 * Tanggal rekening koran: `yyyy-mm-dd` (ISO) atau `dd/mm/yyyy` (format bank
 * Indonesia). Pola dicocokkan EKSPLISIT — dulu `Date.parse` dicoba lebih dulu
 * sehingga V8 membaca "05/01/2026" sebagai mm/dd (1 Mei) sementara
 * "13/01/2026" jatuh ke cabang dd/mm: satu file, dua tafsir. Hasil selalu
 * UTC-midnight, sama dengan `entryDate` jurnal.
 */
export function parseLooseDate(s: string): Date | null {
  const t = s.trim();
  const iso = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ].*)?$/);
  if (iso) return utcDateFromParts(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  const m = t.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (!m) return null;
  let y = Number(m[3]);
  if (y < 100) y += 2000;
  return utcDateFromParts(y, Number(m[2]), Number(m[1]));
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
