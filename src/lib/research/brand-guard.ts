import "server-only";

import { prisma } from "@/lib/prisma";
import {
  dedupeBrandNames,
  extractForbiddenBrandsFromKeywords,
  sanitizeActionPlan,
  sanitizeCopyKeywords,
  sanitizeRelatedProducts,
  sanitizeStringArray,
  sanitizeTextAgainstBrands,
} from "@/lib/research/brand-guard-sanitize";

export type BrandGuardInput = {
  /** Brand/toko pihak ketiga dari data pasar — dilarang dipakai di copy/aksi */
  forbiddenBrands: string[];
};

export {
  dedupeBrandNames,
  extractForbiddenBrandsFromKeywords,
  sanitizeActionPlan,
  sanitizeCopyKeywords,
  sanitizeRelatedProducts,
  sanitizeStringArray,
  sanitizeTextAgainstBrands,
};

const MAX_FORBIDDEN = 30;

/** Extract candidate brand/toko tokens from free text (product names, shop names). */
export function extractForbiddenBrandsFromStrings(texts: string[]): string[] {
  const candidates: string[] = [];
  for (const text of texts) {
    const t = text.trim();
    if (!t) continue;
    candidates.push(t);
    // First word of product title often equals brand on marketplace
    const first = t.split(/\s+/)[0];
    if (first && first.length >= 2) candidates.push(first);
  }
  return dedupeBrandNames(candidates);
}

export function buildBrandGuardInstruction(input: BrandGuardInput): string {
  const list =
    input.forbiddenBrands.length > 0
      ? input.forbiddenBrands.map((b) => `"${b}"`).join(", ")
      : "(tidak terdeteksi — tetap jangan mengarang nama brand)";

  return `
ATURAN BRAND (WAJIB):
- Brand/toko pihak ketiga terdeteksi di pasar: ${list}
- DILARANG menyebut brand/toko/produk spesifik pihak ketiga ini di: namingSuggestions, copyKeywords, listingTitle, listingDescription, kampanye, actionPlan, atau rekomendasi konten.
- WAJIB gunakan bahasa generik kategori/benefit (mis. "moisturizer ringan non-comedogenic", "serum brightening") TANPA nama brand manapun.
- Brand terlarang BOLEH muncul HANYA di evidence.label saat mengutip data mentah (keyword/volume), BUKAN di action, rationale, namingSuggestions, copyKeywords, atau kampanye.
- Keyword mentah yang mengandung nama brand hanya untuk analisis volume — JANGAN disalin verbatim ke rekomendasi listing/iklan.
`.trim();
}

/** Market brands from research tables — NOT from DCC Brand model. */
export async function gatherMarketBrandNames(opts?: {
  category?: string;
  limit?: number;
}): Promise<string[]> {
  const limit = opts?.limit ?? 40;
  const categoryFilter = opts?.category
    ? { contains: opts.category, mode: "insensitive" as const }
    : undefined;

  const [competitors, reviews, discoveryShops] = await Promise.all([
    prisma.researchCompetitor.findMany({
      where: { isActive: true },
      select: { brand: true, name: true },
      take: limit,
    }),
    categoryFilter
      ? prisma.reviewIntelSource.findMany({
          where: { status: "READY", productName: categoryFilter },
          select: { competitorBrand: true, productName: true },
          take: limit,
        })
      : prisma.reviewIntelSource.findMany({
          where: { status: "READY" },
          select: { competitorBrand: true, productName: true },
          take: limit,
        }),
    categoryFilter
      ? prisma.productDiscoveryItem.findMany({
          where: {
            shopName: { not: null },
            query: { keyword: categoryFilter },
          },
          select: { shopName: true, name: true },
          take: limit * 2,
        })
      : prisma.productDiscoveryItem.findMany({
          where: { shopName: { not: null } },
          select: { shopName: true, name: true },
          take: limit * 2,
          orderBy: { id: "desc" },
        }),
  ]);

  const texts: string[] = [];
  for (const c of competitors) {
    if (c.brand) texts.push(c.brand);
    texts.push(c.name);
  }
  for (const r of reviews) {
    if (r.competitorBrand) texts.push(r.competitorBrand);
  }
  for (const d of discoveryShops) {
    if (d.shopName) texts.push(d.shopName);
  }

  return dedupeBrandNames(extractForbiddenBrandsFromStrings(texts));
}
