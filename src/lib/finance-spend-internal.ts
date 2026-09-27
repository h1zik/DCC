import "server-only";

import {
  FinanceAuditAction,
  FinanceSpendRequestStatus,
  type Prisma,
} from "@prisma/client";
import { logFinanceAudit } from "@/lib/finance-audit";

/**
 * Buat pengajuan dana (FinanceSpendRequest) dari modul lain — mis. KOL Hub —
 * di dalam transaksi pemanggil.
 *
 * Sengaja TANPA `requireFinance()`: modul pemanggil sudah memeriksa haknya
 * sendiri, dan pengajuan dibuat berstatus SUBMITTED sehingga tetap harus
 * disetujui & dibayar orang Finance lewat alur biasa (termasuk aturan
 * requester ≠ approver). Tidak ada jalan pintas ke jurnal dari sini.
 */
export async function createSpendRequestInTx(
  tx: Prisma.TransactionClient,
  input: {
    title: string;
    description?: string | null;
    amount: Prisma.Decimal;
    expenseAccountId: string | null;
    brandId: string | null;
    requestedById: string;
    /** Siapa yang memicu (dicatat di audit) — boleh beda dengan requester. */
    actorId: string;
  },
): Promise<string> {
  if (!input.amount.gt(0)) {
    throw new Error("Nominal pengajuan dana harus lebih dari 0.");
  }
  const created = await tx.financeSpendRequest.create({
    data: {
      title: input.title.slice(0, 200),
      description: input.description?.slice(0, 2000) ?? null,
      amount: input.amount,
      expenseAccountId: input.expenseAccountId,
      brandId: input.brandId,
      status: FinanceSpendRequestStatus.SUBMITTED,
      requestedById: input.requestedById,
    },
    select: { id: true },
  });
  await logFinanceAudit(tx, {
    action: FinanceAuditAction.SPEND_SUBMIT,
    actorId: input.actorId,
    entityId: created.id,
    detail: `${input.title} — ${input.amount.toFixed(2)} (otomatis dari KOL Hub)`,
  });
  return created.id;
}

/**
 * Tarik pengajuan yang belum dibayar karena sumbernya dibatalkan (mis. jadwal
 * KOL batal). Status jadi REJECTED dengan catatan jelas. Pengajuan yang sudah
 * PAID tidak disentuh — pengembalian dana urusan Finance.
 *
 * @returns status akhir pengajuan (untuk memberi tahu pemanggil).
 */
export async function withdrawSpendRequestInTx(
  tx: Prisma.TransactionClient,
  requestId: string,
  actorId: string,
  reason: string,
): Promise<FinanceSpendRequestStatus | null> {
  const r = await tx.financeSpendRequest.findUnique({
    where: { id: requestId },
    select: { status: true, title: true },
  });
  if (!r) return null;
  if (r.status === FinanceSpendRequestStatus.PAID || r.status === FinanceSpendRequestStatus.REJECTED) {
    return r.status;
  }
  const updated = await tx.financeSpendRequest.updateMany({
    where: {
      id: requestId,
      status: {
        in: [
          FinanceSpendRequestStatus.DRAFT,
          FinanceSpendRequestStatus.SUBMITTED,
          FinanceSpendRequestStatus.APPROVED,
        ],
      },
    },
    data: {
      status: FinanceSpendRequestStatus.REJECTED,
      decidedById: actorId,
      decidedAt: new Date(),
      decisionNote: `Ditarik otomatis: ${reason}`.slice(0, 500),
    },
  });
  if (updated.count === 0) {
    // Berubah di tengah jalan (mis. baru saja dibayar) — baca ulang.
    const again = await tx.financeSpendRequest.findUnique({
      where: { id: requestId },
      select: { status: true },
    });
    return again?.status ?? null;
  }
  await logFinanceAudit(tx, {
    action: FinanceAuditAction.SPEND_REJECT,
    actorId,
    entityId: requestId,
    detail: `Ditarik (sumber dibatalkan): ${r.title} — ${reason}`,
  });
  return FinanceSpendRequestStatus.REJECTED;
}
