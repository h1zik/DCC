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

FAKTOR RISIKO TERIDENTIFIKASI (dari keluhan pasar & social — WAJIB dipertimbangkan):
${
    input.context.riskFactors.length > 0
      ? input.context.riskFactors
          .map((r) => `- [${r.severity}] ${r.label} (sumber: ${r.source.label})`)
          .join("\n")
      : "- (tidak ada risiko eksplisit terdeteksi)"
  }

Tugas:
- Beri skor 0–100 untuk marketDemand, differentiation, pricingFit, overall.
- "risks": daftar risiko (gabungkan faktor risiko di atas + risiko lain yang kamu lihat).
- "decision": "GO" (skor kuat & risiko terkelola), "PIVOT" (potensial tapi perlu revisi konsep/risiko sedang), atau "NO_GO" (risiko tinggi / demand lemah).
- "decisionReason": 1 kalimat alasan keputusan, kaitkan dengan faktor risiko bila relevan.

Balas JSON:
{
  "marketDemand": number,
  "differentiation": number,
  "pricingFit": number,
  "overall": number,
  "risks": ["string"],
  "decision": "GO" | "PIVOT" | "NO_GO",
  "decisionReason": "string",
  "aiSummary": "ringkasan 2-3 kalimat"
}`;
}
