"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireBrandManager } from "@/lib/brand-research/auth";
import {
  getBrandPortfolio,
  listProductDiscoveryOptions,
  saveBrandPortfolio,
} from "@/lib/brand-research/portfolio/portfolio-service";

const lineSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  category: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  targetAudience: z.string().optional().nullable(),
  role: z.enum(["HERO", "CORE", "FLANKER", "EXPERIMENTAL"]).optional().nullable(),
  productDiscoveryQueryId: z.string().optional().nullable(),
  sortOrder: z.number().int().optional(),
});

const saveSchema = z.object({
  brandId: z.string().min(1),
  summary: z.string().optional().nullable(),
  lines: z.array(lineSchema).min(1),
});

export async function getBrandPortfolioPageData(brandId: string) {
  await requireBrandManager();
  z.string().min(1).parse(brandId);

  const [portfolio, discoveryOptions] = await Promise.all([
    getBrandPortfolio(brandId),
    listProductDiscoveryOptions(),
  ]);

  return { portfolio, discoveryOptions };
}

export async function saveBrandPortfolioAction(
  input: z.infer<typeof saveSchema>,
) {
  const session = await requireBrandManager();
  const data = saveSchema.parse(input);

  const portfolio = await saveBrandPortfolio(session.user.id, data.brandId, {
    summary: data.summary,
    lines: data.lines,
  });

  revalidatePath("/brand-hub/portfolio");
  revalidatePath("/brand-hub/strategy");
  return portfolio;
}
