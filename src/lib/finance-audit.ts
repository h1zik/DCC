import "server-only";

import type { FinanceAuditAction, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type Db = typeof prisma | Prisma.TransactionClient;

/**
 * Tulis satu event ke jejak audit finance (append-only).
 *
 * Panggil dengan `tx` bila aksinya sendiri berjalan dalam transaksi — event
 * ikut commit/rollback bersama aksinya, tidak pernah tercatat untuk aksi
 * yang gagal. Tabel ini sengaja TIDAK ikut dihapus oleh reset data demo.
 */
export async function logFinanceAudit(
  db: Db,
  event: {
    action: FinanceAuditAction;
    actorId: string;
    entityId?: string | null;
    detail?: string | null;
  },
): Promise<void> {
  await db.financeAuditEvent.create({
    data: {
      action: event.action,
      actorId: event.actorId,
      entityId: event.entityId?.slice(0, 64) ?? null,
      detail: event.detail?.slice(0, 1000) ?? null,
    },
  });
}
