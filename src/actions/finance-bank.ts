"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireFinance } from "@/lib/auth-helpers";
import { toDecimal } from "@/lib/finance-money";

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
  await requireFinance();
  const data = createBankSchema.parse(input);
  await prisma.financeBankAccount.create({
    data: {
      name: data.name,
      ledgerAccountId: data.ledgerAccountId,
      institution: data.institution?.trim() || null,
      accountMask: data.accountMask?.trim() || null,
      openingBalance: toDecimal(data.openingBalance),
      openingAsOf: data.openingAsOf,
    },
  });
  paths();
}

const importSchema = z.object({
  bankAccountId: z.string().min(1),
  fileName: z.string().min(1),
  csvText: z.string().min(1),
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

function parseFlexibleBankCsv(text: string): {
  txnDate: Date;
  description: string;
  amount: Prisma.Decimal;
}[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const out: {
    txnDate: Date;
    description: string;
    amount: Prisma.Decimal;
  }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const parts = splitCsvLine(raw);
    if (parts.length < 3) continue;
    const [a, b, c] = parts;
    const lower = `${a} ${b} ${c}`.toLowerCase();
    if (
      i === 0 &&
      (lower.includes("tanggal") ||
        lower.includes("date") ||
        lower.includes("description") ||
        lower.includes("amount"))
    ) {
      continue;
    }

    const txnDate = parseLooseDate(a);
    if (!txnDate) continue;
    const description = b.trim();
    const amount = parseAmount(c);
    if (!amount) continue;
    out.push({ txnDate, description, amount });
  }

  return out;
}

function splitCsvLine(line: string): string[] {
  const delim = line.includes(";") && !line.includes(",") ? ";" : ",";
  return line.split(delim).map((s) => s.trim().replace(/^"|"$/g, ""));
}

function parseLooseDate(s: string): Date | null {
  const t = s.trim();
  const iso = Date.parse(t);
  if (!Number.isNaN(iso)) return new Date(iso);
  const m = t.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (!m) return null;
  const d = Number(m[1]);
  const mo = Number(m[2]) - 1;
  let y = Number(m[3]);
  if (y < 100) y += 2000;
  const dt = new Date(y, mo, d);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function parseAmount(s: string): Prisma.Decimal | null {
  try {
    const normalized = s.replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
    const n = Number(normalized);
    if (Number.isNaN(n)) return null;
    return new Prisma.Decimal(normalized);
  } catch {
    return null;
  }
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
