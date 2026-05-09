import "server-only";

import type { Prisma } from "@prisma/client";

/**
 * Hasilkan nomor jurnal sekuensial per tahun, mis. `JE-2026-000123`.
 * Dipanggil di dalam transaksi posting agar nomor tidak bocor jika posting
 * dibatalkan. Best practice akuntansi: setiap posted entry punya nomor
 * unik berurutan (audit trail).
 */
export async function nextJournalNumber(
  tx: Prisma.TransactionClient,
  entryDate: Date,
): Promise<string> {
  const year = entryDate.getFullYear();
  const prefix = `JE-${year}-`;

  const last = await tx.financeJournalEntry.findFirst({
    where: { entryNumber: { startsWith: prefix } },
    orderBy: { entryNumber: "desc" },
    select: { entryNumber: true },
  });

  const nextSeq = (() => {
    if (!last?.entryNumber) return 1;
    const tail = last.entryNumber.slice(prefix.length);
    const n = Number(tail);
    return Number.isFinite(n) ? n + 1 : 1;
  })();

  return `${prefix}${String(nextSeq).padStart(6, "0")}`;
}
