"use server";

import { FinanceAuditAction } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireFinance } from "@/lib/auth-helpers";
import { toDecimal } from "@/lib/finance-money";
import { logFinanceAudit } from "@/lib/finance-audit";

export async function listFinanceFxRates() {
  await requireFinance();
  const rows = await prisma.financeFxRate.findMany({
    orderBy: [{ currencyCode: "asc" }, { validFrom: "desc" }],
    take: 200,
  });
  return rows;
}

const upsertSchema = z.object({
  currencyCode: z.string().length(3).transform((s) => s.toUpperCase()),
  rateToBase: z.string().min(1),
  validFrom: z.coerce.date(),
});

/** `rateToBase`: 1 unit foreign = rateToBase IDR. */
export async function upsertFinanceFxRate(input: z.infer<typeof upsertSchema>) {
  const session = await requireFinance();
  const data = upsertSchema.parse(input);
  const rate = toDecimal(data.rateToBase);
  if (rate.lte(0)) throw new Error("Kurs harus positif.");
  if (data.currencyCode === "IDR") {
    throw new Error("Gunakan valuta asing (bukan IDR) sebagai kode.");
  }

  const key = {
    currencyCode_validFrom: {
      currencyCode: data.currencyCode,
      validFrom: data.validFrom,
    },
  };
  await prisma.$transaction(async (tx) => {
    const prev = await tx.financeFxRate.findUnique({
      where: key,
      select: { rateToBase: true },
    });
    const saved = await tx.financeFxRate.upsert({
      where: key,
      create: {
        currencyCode: data.currencyCode,
        rateToBase: rate,
        validFrom: data.validFrom,
      },
      update: { rateToBase: rate },
      select: { id: true },
    });
    await logFinanceAudit(tx, {
      action: FinanceAuditAction.FX_RATE_UPSERT,
      actorId: session.user.id,
      entityId: saved.id,
      detail: `Kurs ${data.currencyCode} berlaku ${data.validFrom.toISOString().slice(0, 10)}: ${prev ? prev.rateToBase.toString() : "—"} → ${rate.toString()}`,
      meta: {
        before: prev ? { rateToBase: prev.rateToBase.toString() } : null,
        after: { rateToBase: rate.toString() },
      },
    });
  });

  revalidatePath("/finance/currencies");
}

export async function deleteFinanceFxRate(id: string) {
  const session = await requireFinance();
  await prisma.$transaction(async (tx) => {
    const rate = await tx.financeFxRate.findUniqueOrThrow({ where: { id } });
    await logFinanceAudit(tx, {
      action: FinanceAuditAction.FX_RATE_DELETE,
      actorId: session.user.id,
      entityId: id,
      detail: `${rate.currencyCode} ${rate.rateToBase.toString()} berlaku sejak ${rate.validFrom.toISOString().slice(0, 10)}`,
    });
    await tx.financeFxRate.delete({ where: { id } });
  });
  revalidatePath("/finance/currencies");
}
