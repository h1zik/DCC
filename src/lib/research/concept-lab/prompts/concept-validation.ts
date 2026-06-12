import "server-only";

import type { ConceptData } from "@/lib/research/concept-lab/types";
import type { ConceptContext } from "@/lib/research/concept-lab/gather-concept-context";

export function buildConceptValidationPrompt(input: {
  category: string;
  targetMarket?: string | null;
  priceTargetMin?: number | null;
  priceTargetMax?: number | null;
  conceptData: ConceptData;
  context: ConceptContext;
}): string {
  return `Kamu adalah validator konsep produk beauty Indonesia.

Nilai konsep berikut berdasarkan data pasar (skor 0–100 per dimensi).

Kategori: ${input.category}
Target market: ${input.targetMarket ?? "umum"}
Harga target: ${
    input.priceTargetMin != null && input.priceTargetMax != null
      ? `Rp ${input.priceTargetMin} – Rp ${input.priceTargetMax}`
      : "—"
  }

Konsep:
${JSON.stringify(input.conceptData, null, 2)}

Konteks pasar:
${JSON.stringify(input.context, null, 2)}

Balas JSON:
{
  "marketDemand": number,
  "differentiation": number,
  "pricingFit": number,
  "overall": number,
  "risks": ["string"],
  "aiSummary": "ringkasan 2-3 kalimat"
}`;
}
