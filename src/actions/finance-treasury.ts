"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireFinance } from "@/lib/auth-helpers";
import { createPostedFinanceJournal } from "@/actions/finance-journals";

const transferSchema = z.object({
  fromBankAccountId: z.string().min(1),
  toBankAccountId: z.string().min(1),
  amount: z.string().min(1),
  transferDate: z.coerce.date(),
  memo: z.string().max(500).optional().nullable(),
});

/** Transfer antar rekening operasional (double-entry terposting otomatis). */
export async function createFinanceInternalTransfer(
  input: z.infer<typeof transferSchema>,
) {
  await requireFinance();
  const data = transferSchema.parse(input);
  if (data.fromBankAccountId === data.toBankAccountId) {
    throw new Error("Rekening asal dan tujuan harus berbeda.");
  }

  const [from, to] = await Promise.all([
    prisma.financeBankAccount.findUniqueOrThrow({
      where: { id: data.fromBankAccountId },
    }),
    prisma.financeBankAccount.findUniqueOrThrow({
      where: { id: data.toBankAccountId },
    }),
  ]);

  await createPostedFinanceJournal({
    entryDate: data.transferDate,
    reference: `TRF-${data.fromBankAccountId.slice(0, 6)}`,
    memo: data.memo?.trim() || "Transfer internal",
    lines: [
      {
        accountId: to.ledgerAccountId,
        debit: data.amount,
        credit: "0",
        memo: "Terima transfer",
      },
      {
        accountId: from.ledgerAccountId,
        debit: "0",
        credit: data.amount,
        memo: "Kirim transfer",
      },
    ],
  });

  revalidatePath("/finance/treasury");
}

export async function financeCashflowLines(options: {
  from: Date;
  to: Date;
  brandId?: string | null;
}) {
  await requireFinance();
  const end = new Date(options.to);
  end.setHours(23, 59, 59, 999);

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
