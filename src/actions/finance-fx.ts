"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireFinance } from "@/lib/auth-helpers";
import { toDecimal } from "@/lib/finance-money";

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
  await requireFinance();
  const data = upsertSchema.parse(input);
  const rate = toDecimal(data.rateToBase);
  if (rate.lte(0)) throw new Error("Kurs harus positif.");
  if (data.currencyCode === "IDR") {
    throw new Error("Gunakan valuta asing (bukan IDR) sebagai kode.");
  }

  await prisma.financeFxRate.upsert({
    where: {
      currencyCode_validFrom: {
        currencyCode: data.currencyCode,
        validFrom: data.validFrom,
      },
    },
    create: {
      currencyCode: data.currencyCode,
      rateToBase: rate,
      validFrom: data.validFrom,
    },
    update: { rateToBase: rate },
  });

  revalidatePath("/finance/currencies");
}

export async function deleteFinanceFxRate(id: string) {
  await requireFinance();
  await prisma.financeFxRate.delete({ where: { id } });
  revalidatePath("/finance/currencies");
}
