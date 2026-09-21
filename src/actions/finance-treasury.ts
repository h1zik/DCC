"use server";

import { FinanceAuditAction } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireFinance } from "@/lib/auth-helpers";
import { logFinanceAudit } from "@/lib/finance-audit";
import { utcDateOnly, utcEndOfDay } from "@/lib/finance-dates";
import { createPostedEntryInTx } from "@/lib/finance-journal-post";
import { positiveMoneyString, toDecimal } from "@/lib/finance-money";
import { ensurePeriodOpen } from "@/lib/finance-period-lock";

const transferSchema = z.object({
  fromBankAccountId: z.string().min(1),
  toBankAccountId: z.string().min(1),
  amount: positiveMoneyString,
  transferDate: z.coerce.date(),
  memo: z.string().max(500).optional().nullable(),
});

/** Transfer antar rekening operasional (double-entry terposting otomatis). */
export async function createFinanceInternalTransfer(
  input: z.infer<typeof transferSchema>,
) {
  const session = await requireFinance();
  const data = transferSchema.parse(input);
  if (data.fromBankAccountId === data.toBankAccountId) {
    throw new Error("Rekening asal dan tujuan harus berbeda.");
  }
  const transferDate = utcDateOnly(data.transferDate);
  const amount = toDecimal(data.amount).toFixed(2);

  const [from, to] = await Promise.all([
    prisma.financeBankAccount.findUniqueOrThrow({
      where: { id: data.fromBankAccountId },
    }),
    prisma.financeBankAccount.findUniqueOrThrow({
      where: { id: data.toBankAccountId },
    }),
  ]);

  // Dua rekening yang menunjuk akun ledger yang sama menghasilkan jurnal
  // debit/kredit ke akun yang sama — seimbang tapi tanpa makna.
  if (from.ledgerAccountId === to.ledgerAccountId) {
    throw new Error(
      "Kedua rekening memakai akun ledger yang sama — transfer tidak mengubah apa pun di buku.",
    );
  }

  await prisma.$transaction(async (tx) => {
    await ensurePeriodOpen(transferDate, tx);
    const journalId = await createPostedEntryInTx(tx, {
      entryDate: transferDate,
      reference: `TRF-${data.fromBankAccountId.slice(0, 6)}`,
      memo: data.memo?.trim() || "Transfer internal",
      createdById: session.user.id,
      lines: [
        { accountId: to.ledgerAccountId, debit: amount, credit: "0", memo: "Terima transfer" },
        { accountId: from.ledgerAccountId, debit: "0", credit: amount, memo: "Kirim transfer" },
      ],
    });
    await logFinanceAudit(tx, {
      action: FinanceAuditAction.TRANSFER,
      actorId: session.user.id,
      entityId: journalId,
      detail: `Transfer ${amount}: ${from.name} → ${to.name}`,
    });
  });

  revalidatePath("/finance/treasury");
}

export async function financeCashflowLines(options: {
  from: Date;
  to: Date;
  brandId?: string | null;
}) {
  await requireFinance();
  const end = utcEndOfDay(options.to);

  return prisma.financeJournalLine.findMany({
    where: {
      entry: {
        status: "POSTED",
        entryDate: { gte: options.from, lte: end },
      },
      account: { tracksCashflow: true },
      ...(options.brandId ? { brandId: options.brandId } : {}),
    },
    include: {
      account: true,
      entry: { select: { entryDate: true, reference: true, memo: true } },
    },
    orderBy: [{ entry: { entryDate: "desc" } }],
    take: 500,
  });
}
