import "server-only";

import { FinanceSpendRequestStatus, Prisma } from "@prisma/client";
import { createSpendRequestInTx } from "@/lib/finance-spend-internal";

/** Akun beban default untuk fee KOL (COA bawaan DCC). */
export const KOL_EXPENSE_ACCOUNT_CODE = "6100";

export type KolPaymentStatus = "NONE" | "WAITING" | "APPROVED" | "PAID" | "REJECTED";

/** Terjemahkan status spend request Finance jadi status bayar di KOL Hub. */
export function paymentStatusOf(
  status: FinanceSpendRequestStatus | null | undefined,
): KolPaymentStatus {
  switch (status) {
    case FinanceSpendRequestStatus.DRAFT:
    case FinanceSpendRequestStatus.SUBMITTED:
      return "WAITING";
    case FinanceSpendRequestStatus.APPROVED:
      return "APPROVED";
    case FinanceSpendRequestStatus.PAID:
      return "PAID";
    case FinanceSpendRequestStatus.REJECTED:
      return "REJECTED";
    default:
      return "NONE";
  }
}

/**
 * Buat pengajuan dana untuk jadwal yang baru disetujui (di transaksi approve).
 * Jadwal barter / nominal 0 tidak butuh pengajuan. Idempoten: jadwal yang
 * sudah punya pengajuan dilewati.
 */
export async function createSpendRequestsForSchedules(
  tx: Prisma.TransactionClient,
  scheduleIds: string[],
  actorId: string,
): Promise<number> {
  if (scheduleIds.length === 0) return 0;
  const [account, rows] = await Promise.all([
    tx.financeLedgerAccount.findFirst({
      where: { code: KOL_EXPENSE_ACCOUNT_CODE, isActive: true },
      select: { id: true },
    }),
    tx.kolSchedule.findMany({
      where: { id: { in: scheduleIds }, spendRequestId: null },
      select: {
        id: true,
        subNumber: true,
        brandId: true,
        rate: true,
        additionalCost: true,
        requestedById: true,
        scheduledAt: true,
        kol: { select: { fullName: true, bankName: true, accountHolder: true } },
        socialAccount: { select: { platform: true, handle: true } },
        campaign: { select: { title: true } },
      },
    }),
  ]);

  let created = 0;
  for (const s of rows) {
    const amount = new Prisma.Decimal(s.rate).plus(s.additionalCost);
    if (!amount.gt(0)) continue;
    const description = [
      `Fee endorsement ${s.kol.fullName} (@${s.socialAccount.handle}, ${s.socialAccount.platform === "TIKTOK" ? "TikTok" : "Instagram"})`,
      `Campaign: ${s.campaign.title}`,
      `Rate ${s.rate.toFixed(0)} + biaya tambahan ${s.additionalCost.toFixed(0)}`,
      s.kol.bankName ? `Rekening: ${s.kol.bankName} a.n. ${s.kol.accountHolder ?? "-"} (nomor lengkap di profil KOL Hub)` : "Rekening KOL belum diisi di KOL Hub",
      `Nomor jadwal KOL Hub: ${s.subNumber}`,
    ].join("\n");
    const requestId = await createSpendRequestInTx(tx, {
      title: `KOL ${s.subNumber} – ${s.kol.fullName}`,
      description,
      amount,
      expenseAccountId: account?.id ?? null,
      brandId: s.brandId,
      // Pengaju jadwal = pengaju dana, supaya approver Finance tetap orang lain.
      requestedById: s.requestedById ?? actorId,
      actorId,
    });
    await tx.kolSchedule.update({ where: { id: s.id }, data: { spendRequestId: requestId } });
    created += 1;
  }
  return created;
}
