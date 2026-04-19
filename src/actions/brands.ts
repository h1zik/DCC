"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdministrator } from "@/lib/auth-helpers";

const brandSchema = z.object({
  name: z.string().min(1),
  logo: z.string().optional().nullable(),
  colorCode: z.string().optional().nullable(),
});

export async function createBrand(input: z.infer<typeof brandSchema>) {
  await requireAdministrator();
  const data = brandSchema.parse(input);
  await prisma.brand.create({ data });
  revalidatePath("/brands");
  revalidatePath("/");
  revalidatePath("/products");
  revalidatePath("/inventory");
}

export async function updateBrand(
  id: string,
  input: z.infer<typeof brandSchema>,
) {
  await requireAdministrator();
  const data = brandSchema.parse(input);
  await prisma.brand.update({ where: { id }, data });
  revalidatePath("/brands");
  revalidatePath("/");
  revalidatePath("/products");
  revalidatePath("/inventory");
}

export async function deleteBrand(id: string) {
  await requireAdministrator();
  await prisma.brand.delete({ where: { id } });
  revalidatePath("/brands");
  revalidatePath("/");
  revalidatePath("/products");
  revalidatePath("/inventory");
}
