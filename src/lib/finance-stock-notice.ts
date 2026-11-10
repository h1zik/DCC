import "server-only";

import { NotificationType, Prisma, StockLogType, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notifyUser } from "@/lib/notify";
import { parseSystemMeta } from "@/lib/stock-log-utils";

/**
 * Jembatan Inventori → Finance: setiap mutasi stok baru membuat satu
 * `FinanceStockNotice` (kotak masuk di /finance/stock-movements) dan
 * notifikasi bell untuk tim Finance. Notice dibuat di dalam transaksi mutasi
 * supaya tidak pernah ada mutasi tanpa notice (atau sebaliknya).
 */

export const AUTO_DISMISS_NOTE =
  "Otomatis: mutasi di-void/dikoreksi di Inventori sebelum sempat dicatat.";

export async function createStockNotices(
  tx: Prisma.TransactionClient,
  stockLogIds: string[],
): Promise<void> {
  if (stockLogIds.length === 0) return;
  await tx.financeStockNotice.createMany({
    data: stockLogIds.map((stockLogId) => ({ stockLogId })),
    skipDuplicates: true,
  });
}

/**
 * Dipanggil SEBELUM baris void/koreksi dibuat. Mencari notice milik baris yang
 * membawa nilai efektif mutasi (baris asli, atau REPLACEMENT terakhirnya):
 * - masih menunggu → otomatis diabaikan (belum ada yang perlu dibalik Finance);
 * - sudah punya jurnal → `hadJournal: true`, pemanggil membuat notice untuk
 *   baris pembaliknya agar Finance ikut membalik pencatatannya.
 */
export async function settlePriorStockNotice(
  tx: Prisma.TransactionClient,
  log: { id: string; productId: string },
): Promise<{ hadJournal: boolean }> {
  const corrections = await tx.stockLog.findMany({
    where: {
      productId: log.productId,
      note: { startsWith: "[SYS]", contains: log.id },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, note: true },
  });
  const lastReplacement = corrections.find((row) => {
    const meta = parseSystemMeta(row);
    return meta.action === "REPLACEMENT" && meta.targetId === log.id;
  });
  const carrierId = lastReplacement?.id ?? log.id;

  const notice = await tx.financeStockNotice.findUnique({
    where: { stockLogId: carrierId },
    select: { id: true, journalEntryId: true, dismissedAt: true },
  });
  if (!notice) return { hadJournal: false };
  if (notice.journalEntryId) return { hadJournal: true };
  if (!notice.dismissedAt) {
    await tx.financeStockNotice.update({
      where: { id: notice.id },
      data: { dismissedAt: new Date(), dismissNote: AUTO_DISMISS_NOTE },
    });
  }
  return { hadJournal: false };
}

export function describeStockMovement(m: {
  type: StockLogType;
  amount: number;
  productName: string;
  sku: string;
}): string {
  const dir = m.type === StockLogType.IN ? "masuk" : "keluar";
  return `${m.amount.toLocaleString("id-ID")} × ${m.productName} (${m.sku}) ${dir}`;
}

/**
 * Notifikasi bell + push ke seluruh tim Finance. Best-effort: kegagalan
 * notifikasi tidak boleh menggagalkan mutasi stok yang sudah ter-commit.
 */
export async function notifyFinanceStockMovement(message: string): Promise<void> {
  try {
    const users = await prisma.user.findMany({
      where: { role: UserRole.FINANCE },
      select: { id: true },
    });
    await Promise.all(
      users.map((u) =>
        notifyUser(u.id, message.slice(0, 500), NotificationType.STOCK_MOVEMENT),
      ),
    );
  } catch (e) {
    console.error("[finance-stock-notice] notify failed", e);
  }
}
