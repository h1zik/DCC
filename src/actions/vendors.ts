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
});

export async function createVendor(input: z.infer<typeof vendorSchema>) {
  await requireLogisticsStaff();
  const data = vendorSchema.parse(input);
  await prisma.vendor.create({ data });
  revalidatePath("/vendors");
  revalidatePath("/");
}

export async function updateVendor(
  id: string,
  input: z.infer<typeof vendorSchema>,
) {
  await requireLogisticsStaff();
  const data = vendorSchema.parse(input);
  await prisma.vendor.update({ where: { id }, data });
  revalidatePath("/vendors");
  revalidatePath("/");
}

export async function deleteVendor(id: string) {
  await requireLogisticsStaff();
  await prisma.vendor.delete({ where: { id } });
  revalidatePath("/vendors");
  revalidatePath("/");
}
