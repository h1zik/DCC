import "server-only";

import type { Prisma } from "@prisma/client";
import { wibYearMonthKey } from "@/lib/kol/time";

/**
 * Nomor order berikutnya, mis. `KOL-2609-0001`. Upsert+increment dalam
 * transaksi pemanggil — baris counter terkunci sampai transaksi selesai,
 * jadi dua pengajuan bersamaan tidak mendapat nomor sama.
 */
export async function nextKolOrderNumber(
  tx: Prisma.TransactionClient,
  now: Date = new Date(),
): Promise<string> {
  const ym = wibYearMonthKey(now);
  const counter = await tx.kolCounter.upsert({
    where: { key: `ORDER-${ym}` },
    create: { key: `ORDER-${ym}`, lastSeq: 1 },
    update: { lastSeq: { increment: 1 } },
  });
  return `KOL-${ym}-${String(counter.lastSeq).padStart(4, "0")}`;
}

/** Nomor slot di dalam order: `KOL-2609-0001-01`. */
export function kolSubNumber(orderNumber: string, index: number): string {
  return `${orderNumber}-${String(index + 1).padStart(2, "0")}`;
}
