"use server";

import { FinanceLedgerType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireFinance } from "@/lib/auth-helpers";
import {
  defaultCoaCreateMany,
  SYSTEM_REFERENCED_ACCOUNT_CODES,
} from "@/lib/finance-default-coa";

export async function ensureFinanceCoaReady() {
  await requireFinance();
  const count = await prisma.financeLedgerAccount.count();
  if (count > 0) {
    // Backfill: jika BELUM ADA akun ber-flag kontrol sama sekali, tandai akun
    // standar 2000 / 1200 sekali. Idempotent. Dulu backfill ini jalan tanpa
    // syarat di setiap render sehingga flag yang sengaja dipindah user ke akun
    // lain terus-menerus dipasang ulang di 2000/1200.
    const [apFlagged, arFlagged] = await Promise.all([
      prisma.financeLedgerAccount.count({ where: { isApControl: true } }),
      prisma.financeLedgerAccount.count({ where: { isArControl: true } }),
    ]);
    if (apFlagged === 0) {
      await prisma.financeLedgerAccount.updateMany({
        where: { code: "2000" },
        data: { isApControl: true },
      });
    }
    if (arFlagged === 0) {
      await prisma.financeLedgerAccount.updateMany({
        where: { code: "1200" },
        data: { isArControl: true },
      });
    }
    return { seeded: false as const };
  }
  await prisma.financeLedgerAccount.createMany({
    data: defaultCoaCreateMany(),
  });
  return { seeded: true as const };
}

export async function listFinanceAccounts(options?: { includeInactive?: boolean }) {
  await requireFinance();
  return prisma.financeLedgerAccount.findMany({
    where: options?.includeInactive ? {} : { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
  });
}

const upsertSchema = z.object({
  id: z.string().optional(),
  code: z.string().min(1).max(32),
  name: z.string().min(1).max(200),
  type: z.nativeEnum(FinanceLedgerType),
  sortOrder: z.number().int().optional(),
  tracksCashflow: z.boolean().optional(),
  isActive: z.boolean().optional(),
  isApControl: z.boolean().optional(),
  isArControl: z.boolean().optional(),
});

export async function upsertFinanceLedgerAccount(
  input: z.infer<typeof upsertSchema>,
) {
  await requireFinance();
  const data = upsertSchema.parse(input);

  // Sanity guard: AP control hanya untuk LIABILITY, AR control hanya untuk ASSET.
  if (data.isApControl && data.type !== FinanceLedgerType.LIABILITY) {
    throw new Error(
      "AP control hanya boleh diaktifkan pada akun bertipe Liabilitas (mis. Hutang Usaha).",
    );
  }
  if (data.isArControl && data.type !== FinanceLedgerType.ASSET) {
    throw new Error(
      "AR control hanya boleh diaktifkan pada akun bertipe Aktiva (mis. Piutang Usaha).",
    );
  }

  if (data.id) {
    const existing = await prisma.financeLedgerAccount.findUniqueOrThrow({
      where: { id: data.id },
      select: { code: true, type: true },
    });
    // Tipe menentukan saldo normal dan letak akun (Neraca vs Laba Rugi).
    // Mengubahnya setelah ada jurnal terposting memindahkan seluruh histori
    // akun itu di semua laporan — kunci, seperti Xero/Odoo.
    if (existing.type !== data.type) {
      const postedLines = await prisma.financeJournalLine.count({
        where: { accountId: data.id, entry: { status: "POSTED" } },
      });
      if (postedLines > 0) {
        throw new Error(
          `Tipe akun tidak bisa diubah: sudah ada ${postedLines} baris jurnal terposting. Buat akun baru lalu pindahkan saldonya lewat jurnal.`,
        );
      }
    }
    if (
      existing.code !== data.code &&
      SYSTEM_REFERENCED_ACCOUNT_CODES.has(existing.code)
    ) {
      throw new Error(
        `Kode ${existing.code} dipakai sistem (saldo awal rekening / rekap pajak) dan belum bisa diubah. Nama akun tetap boleh diganti.`,
      );
    }
    await prisma.financeLedgerAccount.update({
      where: { id: data.id },
      data: {
        code: data.code,
        name: data.name,
        type: data.type,
        sortOrder: data.sortOrder ?? undefined,
        tracksCashflow: data.tracksCashflow ?? undefined,
        isActive: data.isActive ?? undefined,
        isApControl: data.isApControl ?? undefined,
        isArControl: data.isArControl ?? undefined,
      },
    });
  } else {
    await prisma.financeLedgerAccount.create({
      data: {
        code: data.code,
        name: data.name,
        type: data.type,
        sortOrder: data.sortOrder ?? 0,
        tracksCashflow: data.tracksCashflow ?? false,
        isActive: data.isActive ?? true,
        isApControl: data.isApControl ?? false,
        isArControl: data.isArControl ?? false,
      },
    });
  }

  revalidatePath("/finance");
  revalidatePath("/finance/chart-of-accounts");
}

export async function setFinanceAccountActive(
  accountId: string,
  isActive: boolean,
) {
  await requireFinance();
  await prisma.financeLedgerAccount.update({
    where: { id: accountId },
    data: { isActive },
  });
  revalidatePath("/finance/chart-of-accounts");
}

