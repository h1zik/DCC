import { FinanceAuditAction, type Prisma } from "@prisma/client";
import { logFinanceAudit } from "@/lib/finance-audit";
import { createPostedEntryInTx, type FinanceTx } from "@/lib/finance-journal-post";
import { ensurePeriodOpen } from "@/lib/finance-period-lock";

/**
 * Daftarkan rekening (FinanceBankAccount) di atas akun buku besar kas/bank,
 * sekaligus menjurnal saldo awalnya (debit akun bank / kredit 3000 Modal
 * pemilik). Rekening inilah yang muncul di pilihan pembayaran hutang/piutang,
 * pencairan pengajuan dana, dan transfer Treasury.
 */
export async function createBankAccountInTx(
  tx: FinanceTx,
  input: {
    name: string;
    ledgerAccountId: string;
    institution?: string | null;
    accountMask?: string | null;
    opening: Prisma.Decimal;
    openingAsOf: Date;
    actorId: string;
  },
): Promise<string> {
  const { opening } = input;
  const account = await tx.financeBankAccount.create({
    data: {
      name: input.name,
      ledgerAccountId: input.ledgerAccountId,
      institution: input.institution?.trim() || null,
      accountMask: input.accountMask?.trim() || null,
      openingBalance: opening,
      openingAsOf: input.openingAsOf,
    },
    select: { id: true },
  });

  if (!opening.isZero()) {
    await ensurePeriodOpen(input.openingAsOf, tx);
    const equity = await tx.financeLedgerAccount.findUnique({
      where: { code: "3000" },
    });
    if (!equity) {
      throw new Error('Akun "3000 Modal pemilik" tidak ada — inisialisasi CoA.');
    }
    const amtAbs = opening.abs().toFixed(2);
    const bankLine = {
      accountId: input.ledgerAccountId,
      memo: "Saldo awal rekening",
    };
    const equityLine = {
      accountId: equity.id,
      memo: `Saldo awal ${input.name}`,
    };
    await createPostedEntryInTx(tx, {
      entryDate: input.openingAsOf,
      reference: `OPN-${account.id.slice(0, 8)}`,
      memo: `Saldo awal rekening ${input.name}`,
      createdById: input.actorId,
      lines: opening.gt(0)
        ? [
            { ...bankLine, debit: amtAbs, credit: "0" },
            { ...equityLine, debit: "0", credit: amtAbs },
          ]
        : [
            { ...equityLine, debit: amtAbs, credit: "0" },
            { ...bankLine, debit: "0", credit: amtAbs },
          ],
    });
  }
  await logFinanceAudit(tx, {
    action: FinanceAuditAction.BANK_ACCOUNT_CREATE,
    actorId: input.actorId,
    entityId: account.id,
    detail: `Rekening ${input.name} — saldo awal ${opening.toFixed(2)}`,
  });
  return account.id;
}
