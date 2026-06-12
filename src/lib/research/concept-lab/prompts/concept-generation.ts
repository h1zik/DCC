import "server-only";

import type { ConceptContext } from "@/lib/research/concept-lab/gather-concept-context";

export function buildConceptGenerationPrompt(input: {
  category: string;
  targetMarket?: string | null;
  priceTargetMin?: number | null;
  priceTargetMax?: number | null;
  ingredientPreferences?: string | null;
  context: ConceptContext;
}): string {
  return `Kamu adalah product strategist beauty & personal care Indonesia.

Buat konsep produk lengkap berdasarkan input dan data riset berikut.

Kategori: ${input.category}
Target market: ${input.targetMarket ?? "umum Indonesia"}
Budget harga jual: ${
    input.priceTargetMin != null && input.priceTargetMax != null
      ? `Rp ${input.priceTargetMin.toLocaleString("id-ID")} – Rp ${input.priceTargetMax.toLocaleString("id-ID")}`
      : "belum ditentukan"
  }
Preferensi ingredient: ${input.ingredientPreferences ?? "tidak ada"}

Data riset (modul 1–6):
${JSON.stringify(input.context, null, 2)}

Balas JSON:
{
  "nameOptions": ["string", "string", "string"],
  "positioningStatement": "string",
  "heroIngredients": [{ "name": "string", "reason": "string" }],
  "textureFormat": "string",
  "keyClaims": ["string"],
  "packagingDirection": "string",
  "estimatedCogsRange": { "min": number, "max": number },
  "competitorComparison": "string",
  "whyItWillWin": "string"
}`;
}
