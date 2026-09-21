import { Prisma } from "@prisma/client";
import type { AgingDoc, AgingSide } from "./types";

export type OpenDoc = {
  name: string;
  docNumber: string | null;
  dueDate: Date;
  /** Sisa tagihan (string desimal). */
  remaining: string;
};

const DAY_MS = 86_400_000;
const TOP_DOCS = 8;

function utcDay(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/** Hari lewat jatuh tempo (positif = overdue), dihitung per tanggal UTC. */
export function daysOverdue(dueDate: Date, refDate: Date): number {
  return Math.round((utcDay(refDate) - utcDay(dueDate)) / DAY_MS);
}

/**
 * Kelompokkan dokumen terbuka ke bucket umur (belum jatuh tempo / 1–30 /
 * 31–60 / >60 hari). Satu-satunya mesin aging: dipakai PDF bulanan dan
 * halaman Hutang & piutang (`financeApArAging`).
 */
export function bucketAging(docs: OpenDoc[], refDate: Date): AgingSide {
  const zero = () => new Prisma.Decimal(0);
  const buckets = {
    current: zero(),
    d1_30: zero(),
    d31_60: zero(),
    over60: zero(),
  };
  let total = zero();
  let overdueTotal = zero();
  let overdueCount = 0;
  const open: AgingDoc[] = [];

  for (const doc of docs) {
    const remaining = new Prisma.Decimal(doc.remaining);
    if (remaining.lte(0)) continue;
    const days = daysOverdue(doc.dueDate, refDate);

    const key =
      days > 60
        ? "over60"
        : days > 30
          ? "d31_60"
          : days > 0
            ? "d1_30"
            : "current";
    buckets[key] = buckets[key].plus(remaining);
    total = total.plus(remaining);
    if (days > 0) {
      overdueCount += 1;
      overdueTotal = overdueTotal.plus(remaining);
    }
    open.push({
      name: doc.name,
      docNumber: doc.docNumber,
      dueDateIso: doc.dueDate.toISOString(),
      remaining: remaining.toString(),
      daysOverdue: days,
    });
  }

  // Paling telat dulu, lalu nominal terbesar.
  open.sort(
    (a, b) =>
      b.daysOverdue - a.daysOverdue ||
      Number(b.remaining) - Number(a.remaining),
  );

  return {
    total: total.toString(),
    count: open.length,
    overdueCount,
    overdueTotal: overdueTotal.toString(),
    buckets: {
      current: buckets.current.toString(),
      d1_30: buckets.d1_30.toString(),
      d31_60: buckets.d31_60.toString(),
      over60: buckets.over60.toString(),
    },
    top: open.slice(0, TOP_DOCS),
  };
}
