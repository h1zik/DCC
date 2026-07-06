"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireFinance } from "@/lib/auth-helpers";
import { toDecimal } from "@/lib/finance-money";
import { parseFlexibleBankCsv } from "@/lib/finance-bank-csv";
import { createPostedEntryInTx } from "@/lib/finance-journal-post";
import { ensurePeriodOpen } from "@/lib/finance-period-lock";

function paths() {
  revalidatePath("/finance/bank");
}

export async function listFinanceBankAccounts() {
  await requireFinance();
  return prisma.financeBankAccount.findMany({
    orderBy: { name: "asc" },
    include: { ledgerAccount: true },
  });
}

const createBankSchema = z.object({
  name: z.string().min(1).max(200),
  ledgerAccountId: z.string().min(1),
  institution: z.string().max(200).optional().nullable(),
  accountMask: z.string().max(32).optional().nullable(),
  openingBalance: z.string().default("0"),
  openingAsOf: z.coerce.date(),
});

export async function createFinanceBankAccount(
  input: z.infer<typeof createBankSchema>,
) {
  const session = await requireFinance();
  const data = createBankSchema.parse(input);
  const opening = toDecimal(data.openingBalance);

  // Saldo awal harus masuk ledger (debit akun bank / kredit modal pemilik) —
  // dulu hanya tersimpan di kolom openingBalance sehingga angka kas dashboard
  // menyimpang dari neraca (H-07). Kolom openingBalance tetap diisi sebagai
  // informasi form, tetapi sumber kebenaran saldo adalah jurnal.
  await prisma.$transaction(async (tx) => {
    const account = await tx.financeBankAccount.create({
      data: {
        name: data.name,
        ledgerAccountId: data.ledgerAccountId,
        institution: data.institution?.trim() || null,
        accountMask: data.accountMask?.trim() || null,
        openingBalance: opening,
        openingAsOf: data.openingAsOf,
      },
      select: { id: true },
    });

    if (!opening.isZero()) {
      await ensurePeriodOpen(data.openingAsOf, tx);
      const equity = await tx.financeLedgerAccount.findUnique({
        where: { code: "3000" },
      });
      if (!equity) {
        throw new Error('Akun "3000 Modal pemilik" tidak ada — inisialisasi CoA.');
      }
      const amtAbs = opening.abs().toFixed(2);
      const bankLine = {
        accountId: data.ledgerAccountId,
        memo: "Saldo awal rekening",
      };
      const equityLine = {
        accountId: equity.id,
        memo: `Saldo awal ${data.name}`,
      };
      await createPostedEntryInTx(tx, {
        entryDate: data.openingAsOf,
        reference: `OPN-${account.id.slice(0, 8)}`,
        memo: `Saldo awal rekening ${data.name}`,
        createdById: session.user.id,
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
  });
  paths();
}

const importSchema = z.object({
  bankAccountId: z.string().min(1),
  fileName: z.string().min(1),
  csvText: z
    .string()
    .min(1)
    .max(2_000_000, "CSV terlalu besar (maksimal ±2 MB teks)."),
});

/**
 * CSV sederhana: kolom tanggal, keterangan, jumlah (positif = masuk).
 * Mendukung pemisah koma atau titik koma; baris pertama boleh berisi header.
 */
export async function importBankStatementCsv(
  input: z.infer<typeof importSchema>,
) {
  await requireFinance();
  const data = importSchema.parse(input);
  const rows = parseFlexibleBankCsv(data.csvText);
  if (rows.length === 0) {
    throw new Error("Tidak ada baris yang dapat dibaca. Periksa format CSV.");
  }

  const imp = await prisma.bankStatementImport.create({
    data: {
      bankAccountId: data.bankAccountId,
      fileName: data.fileName,
      lines: {
        create: rows.map((r) => ({
          txnDate: r.txnDate,
          description: r.description,
          amount: r.amount,
        })),
      },
    },
  });
  paths();
  return { importId: imp.id, count: rows.length };
}

const matchSchema = z.object({
  statementLineId: z.string().min(1),
  journalLineId: z.string().nullable(),
});

export async function matchBankStatementLine(input: z.infer<typeof matchSchema>) {
  await requireFinance();
  const data = matchSchema.parse(input);
  await prisma.bankStatementLine.update({
    where: { id: data.statementLineId },
    data: { matchedJournalLineId: data.journalLineId },
  });
  paths();
}

export async function listBankImportsForAccount(bankAccountId: string) {
  await requireFinance();
  return prisma.bankStatementImport.findMany({
    where: { bankAccountId },
    orderBy: { importedAt: "desc" },
    include: {
      lines: {
        include: {
          matchedJournalLine: {
            include: {
              entry: true,
              account: true,
            },
          },
        },
      },
    },
  });
}
