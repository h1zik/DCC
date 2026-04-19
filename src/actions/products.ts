"use server";

import { revalidatePath } from "next/cache";
import { PipelineStage } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireLogisticsStaff } from "@/lib/auth-helpers";

const productSchema = z.object({
  brandId: z.string().min(1),
  name: z.string().min(1),
  sku: z.string().min(1),
  currentStock: z.coerce.number().int().min(0),
  minStock: z.coerce.number().int().min(0),
  category: z.string().optional().nullable(),
  pipelineStage: z.nativeEnum(PipelineStage),
});

export async function createProduct(input: z.infer<typeof productSchema>) {
  await requireLogisticsStaff();
  const data = productSchema.parse(input);
  await prisma.product.create({ data });
  revalidatePath("/products");
  revalidatePath("/");
  revalidatePath("/inventory");
}

export async function updateProduct(
  id: string,
  input: z.infer<typeof productSchema>,
) {
  await requireLogisticsStaff();
  const data = productSchema.parse(input);
  await prisma.product.update({ where: { id }, data });
  revalidatePath("/products");
  revalidatePath("/");
  revalidatePath("/inventory");
}

export async function deleteProduct(id: string) {
  await requireLogisticsStaff();
  await prisma.product.delete({ where: { id } });
  revalidatePath("/products");
  revalidatePath("/");
  revalidatePath("/inventory");
}
