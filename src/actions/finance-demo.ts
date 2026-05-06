"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireFinance } from "@/lib/auth-helpers";

/**
 * Hapus seluruh data modul finance untuk kebutuhan demo/reset sandbox.
 * CoA default akan terisi ulang otomatis oleh layout finance saat halaman dibuka lagi.
 */
export async function clearAllFinanceDemoData() {
  await requireFinance();

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
