"use server";

import { FinanceAuditAction } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireFinance } from "@/lib/auth-helpers";
import { logFinanceAudit } from "@/lib/finance-audit";
import { toDecimal } from "@/lib/finance-money";
import { parseFlexibleBankCsv } from "@/lib/finance-bank-csv";
import { createBankAccountInTx } from "@/lib/finance-bank-account";

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
  // menyimpang dari neraca (H-07). Sumber kebenaran saldo adalah jurnal.
  await prisma.$transaction((tx) =>
    createBankAccountInTx(tx, {
      name: data.name,
      ledgerAccountId: data.ledgerAccountId,
      institution: data.institution,
      accountMask: data.accountMask,
      opening,
      openingAsOf: data.openingAsOf,
      actorId: session.user.id,
    }),
  );
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
  const session = await requireFinance();
  const data = importSchema.parse(input);
  const rows = parseFlexibleBankCsv(data.csvText);
  if (rows.length === 0) {
    throw new Error("Tidak ada baris yang dapat dibaca. Periksa format CSV.");
  }

  const imp = await prisma.$transaction(async (tx) => {
    const created = await tx.bankStatementImport.create({
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
    await logFinanceAudit(tx, {
      action: FinanceAuditAction.BANK_IMPORT,
      actorId: session.user.id,
      entityId: created.id,
      detail: `Impor mutasi "${data.fileName}" — ${rows.length} baris`,
    });
    return created;
  });
  paths();
  return { importId: imp.id, count: rows.length };
}

const matchSchema = z.object({
  statementLineId: z.string().min(1),
  journalLineId: z.string().nullable(),
});

export async function matchBankStatementLine(input: z.infer<typeof matchSchema>) {
  const session = await requireFinance();
  const data = matchSchema.parse(input);

  // Validasi konsistensi sebelum match (unmatch = journalLineId null, bebas):
  // baris jurnal harus POSTED dan berada di akun ledger rekening yang sama
  // dengan baris rekening korannya — tanpa ini rekonsiliasi bisa "match" ke
  // baris draf, akun beban, atau lintas rekening.
  if (data.journalLineId) {
    const [stmtLine, journalLine] = await Promise.all([
      prisma.bankStatementLine.findUniqueOrThrow({
        where: { id: data.statementLineId },
        include: {
          import: { include: { bankAccount: { select: { ledgerAccountId: true, name: true } } } },
        },
      }),
      prisma.financeJournalLine.findUniqueOrThrow({
        where: { id: data.journalLineId },
        include: { entry: { select: { status: true } } },
      }),
    ]);
    if (journalLine.entry.status !== "POSTED") {
      throw new Error("Hanya baris jurnal terposting yang bisa direkonsiliasi.");
    }
    if (journalLine.accountId !== stmtLine.import.bankAccount.ledgerAccountId) {
      throw new Error(
        `Baris jurnal bukan milik akun ledger rekening ${stmtLine.import.bankAccount.name}.`,
      );
    }
  }

  await prisma.$transaction(async (tx) => {
    const prev = await tx.bankStatementLine.findUniqueOrThrow({
      where: { id: data.statementLineId },
      select: { matchedJournalLineId: true },
    });
    await tx.bankStatementLine.update({
      where: { id: data.statementLineId },
      data: { matchedJournalLineId: data.journalLineId },
    });
    await logFinanceAudit(tx, {
      action: FinanceAuditAction.BANK_MATCH,
      actorId: session.user.id,
      entityId: data.statementLineId,
      detail: data.journalLineId ? "Cocokkan mutasi dengan baris jurnal" : "Lepas pencocokan mutasi",
      meta: {
        before: { matchedJournalLineId: prev.matchedJournalLineId },
        after: { matchedJournalLineId: data.journalLineId },
      },
    });
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
