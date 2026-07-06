import "server-only";

import type { Prisma } from "@prisma/client";

/**
 * Hasilkan nomor jurnal sekuensial per tahun, mis. `JE-2026-000123`.
 * Dipanggil di dalam transaksi posting agar nomor tidak bocor jika posting
 * dibatalkan. Best practice akuntansi: setiap posted entry punya nomor
 * unik berurutan (audit trail).
 *
 * Memakai tabel counter `FinanceJournalCounter`: UPDATE atomik me-lock baris
 * counter sehingga posting paralel terserialisasi dan tidak pernah
 * menghasilkan nomor kembar. Baris counter diinisialisasi sekali per tahun
 * dari nomor tertinggi yang sudah terpakai (data lama dibuat sebelum tabel
 * counter ada).
 */
export async function nextJournalNumber(
  tx: Prisma.TransactionClient,
  entryDate: Date,
): Promise<string> {
  const year = entryDate.getFullYear();
  const prefix = `JE-${year}-`;
  const tailFrom = prefix.length + 1; // SUBSTRING 1-indexed

  // `${tailFrom}::int` wajib: Prisma mengikat number JS sebagai `bigint`
  // (int8), sedangkan Postgres tidak punya overload `substring(text, bigint)`
  // dan tak ada cast implisit int8→int4 saat resolusi fungsi — tanpa cast
  // eksplisit query gagal `42883: function pg_catalog.substring(text, bigint)
  // does not exist`.
  await tx.$executeRaw`
    INSERT INTO "FinanceJournalCounter" ("year", "lastSeq")
    SELECT ${year},
           COALESCE(MAX(CAST(SUBSTRING("entryNumber" FROM ${tailFrom}::int) AS INTEGER)), 0)
    FROM "FinanceJournalEntry"
    WHERE "entryNumber" LIKE ${`${prefix}%`}
    ON CONFLICT ("year") DO NOTHING`;

  const rows = await tx.$queryRaw<Array<{ lastSeq: number }>>`
    UPDATE "FinanceJournalCounter"
    SET "lastSeq" = "lastSeq" + 1
    WHERE "year" = ${year}
    RETURNING "lastSeq"`;

  const seq = rows[0]?.lastSeq;
  if (!seq || !Number.isFinite(seq)) {
    throw new Error(`Gagal mengambil nomor jurnal untuk tahun ${year}.`);
  }
  return `${prefix}${String(seq).padStart(6, "0")}`;
}
