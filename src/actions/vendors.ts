"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireLogisticsStaff } from "@/lib/auth-helpers";

const vendorSchema = z.object({
  name: z.string().min(1),
  picName: z.string().optional().nullable(),
  contact: z.string().optional().nullable(),
  specialty: z.string().optional().nullable(),
  leadTimeDays: z.coerce.number().int().min(0).optional().nullable(),
  safetyStockDays: z.coerce.number().int().min(0).optional(),
  reviewPeriodDays: z.coerce.number().int().min(1).optional(),
});

export async function createVendor(input: z.infer<typeof vendorSchema>) {
  await requireLogisticsStaff();
  const data = vendorSchema.parse(input);
  await prisma.vendor.create({
    data: {
      name: data.name,
      picName: data.picName ?? undefined,
      contact: data.contact ?? undefined,
      specialty: data.specialty ?? undefined,
      leadTimeDays: data.leadTimeDays ?? undefined,
      safetyStockDays: data.safetyStockDays ?? 7,
      reviewPeriodDays: data.reviewPeriodDays ?? 14,
    },
  });
  revalidatePath("/vendors");
  revalidatePath("/inventory");
  revalidatePath("/");
}

export async function updateVendor(
  id: string,
  input: z.infer<typeof vendorSchema>,
) {
  await requireLogisticsStaff();
  const data = vendorSchema.parse(input);
  await prisma.vendor.update({
    where: { id },
    data: {
      name: data.name,
      picName: data.picName ?? null,
      contact: data.contact ?? null,
      specialty: data.specialty ?? null,
      leadTimeDays: data.leadTimeDays ?? null,
      safetyStockDays: data.safetyStockDays ?? 7,
      reviewPeriodDays: data.reviewPeriodDays ?? 14,
    },
  });
  revalidatePath("/vendors");
  revalidatePath("/inventory");
  revalidatePath("/");
}

export async function deleteVendor(id: string) {
  await requireLogisticsStaff();
  await prisma.vendor.delete({ where: { id } });
  revalidatePath("/vendors");
  revalidatePath("/inventory");
  revalidatePath("/");
}
