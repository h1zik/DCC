"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireFinance } from "@/lib/auth-helpers";
import {
  FINANCE_DEMO_RESET_CONFIRM_PHRASE,
  assertFinanceDemoResetAllowed,
} from "@/lib/finance-demo-policy";
import { logFinanceAudit } from "@/lib/finance-audit";
import { FinanceAuditAction } from "@prisma/client";

/**
 * Hapus seluruh data modul finance untuk kebutuhan demo/reset sandbox.
 * CoA default akan terisi ulang otomatis oleh layout finance saat halaman dibuka lagi.
 *
 * Berlapis-lapis karena aksinya memusnahkan seluruh pembukuan:
 *  1. Diblokir di produksi kecuali FINANCE_DEMO_RESET=true (lihat finance-demo-policy).
 *  2. Ditolak selama masih ada periode pembukuan yang terkunci — data dalam
 *     periode tutup buku tidak boleh lenyap lewat jalur reset.
 *  3. Wajib menyertakan frasa konfirmasi yang diketik user.
 */
export async function clearAllFinanceDemoData(confirmText: string) {
  const session = await requireFinance();
  assertFinanceDemoResetAllowed();

  if (confirmText.trim() !== FINANCE_DEMO_RESET_CONFIRM_PHRASE) {
    throw new Error(
      `Konfirmasi tidak cocok. Ketik "${FINANCE_DEMO_RESET_CONFIRM_PHRASE}" untuk melanjutkan.`,
    );
  }

  const lockedPeriods = await prisma.financePeriodLock.count();
  if (lockedPeriods > 0) {
    throw new Error(
      "Masih ada periode pembukuan yang terkunci. Buka semua kunci periode terlebih dahulu bila memang ingin mereset data finance.",
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.bankStatementLine.deleteMany();
    await tx.bankStatementImport.deleteMany();

    await tx.financeApPayment.deleteMany();
    await tx.financeArPayment.deleteMany();
    await tx.financeJournalLine.deleteMany();

    await tx.financeSpendRequest.deleteMany();
    await tx.financeApBill.deleteMany();
    await tx.financeArInvoice.deleteMany();
    await tx.financeBudgetLine.deleteMany();
    await tx.financeFixedAsset.deleteMany();
    await tx.financeJournalEntry.deleteMany();
    await tx.financeBankAccount.deleteMany();
    await tx.financeFxRate.deleteMany();
    await tx.financeLedgerAccount.deleteMany();
    // FinanceAuditEvent sengaja TIDAK dihapus: jejak pemusnahan data harus
    // tetap ada bahkan setelah reset.
    await logFinanceAudit(tx, {
      action: FinanceAuditAction.DEMO_RESET,
      actorId: session.user.id,
      detail: "Seluruh data finance dihapus via tombol Bersihkan (reset demo).",
    });
  });

  revalidatePath("/finance");
  revalidatePath("/finance/chart-of-accounts");
  revalidatePath("/finance/journals");
  revalidatePath("/finance/general-ledger");
  revalidatePath("/finance/bank");
  revalidatePath("/finance/currencies");
  revalidatePath("/finance/treasury");
  revalidatePath("/finance/ap-ar");
  revalidatePath("/finance/brands-costing");
  revalidatePath("/finance/budget");
  revalidatePath("/finance/approvals");
  revalidatePath("/finance/reports");
  revalidatePath("/finance/fixed-assets");
}
