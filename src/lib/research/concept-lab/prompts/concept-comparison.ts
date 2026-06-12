import "server-only";

import type { ConceptData, ValidationScores } from "@/lib/research/concept-lab/types";

export function buildConceptComparisonPrompt(
  concepts: {
    id: string;
    title: string;
    category: string;
    conceptData: ConceptData;
    validationScores: ValidationScores;
  }[],
): string {
  const lines = concepts.map(
    (c) =>
      `- [${c.id}] ${c.title} (${c.category}) — overall ${c.validationScores.overall}\n${JSON.stringify(c.conceptData, null, 2)}`,
  );

  return `Bandingkan ${concepts.length} konsep produk beauty head-to-head.

Konsep:
${lines.join("\n\n")}

Balas JSON:
{
  "summary": "ringkasan perbandingan",
  "dimensions": [
    {
      "label": "Market Fit",
      "scores": [
        { "conceptId": "string", "conceptTitle": "string", "score": number, "note": "string" }
      ]
    }
  ],
  "winnerId": "id konsep terbaik atau null",
  "recommendation": "rekomendasi keputusan"
}`;
}
