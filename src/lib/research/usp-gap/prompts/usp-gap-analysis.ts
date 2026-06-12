import "server-only";

import type { UspGatheredContext } from "@/lib/research/usp-gap/gather-context";

export function buildUspGapAnalysisPrompt(ctx: UspGatheredContext): string {
  return `Kamu adalah strateg produk beauty & personal care Indonesia.

Analisis kategori: "${ctx.category}"

Data agregat dari modul riset:
${JSON.stringify(ctx, null, 2)}

Tugas:
1. Buat gap matrix: klaim/benefit vs kekosongan pasar (gapScore 0-100, opportunity ringkas)
2. Claim analysis: klaim overused vs masih kosong di pasar
3. Positioning map: axisX default "Harga", axisY default "Efektivitas/Benefit", plot 5-12 poin kompetitor/kategori
4. 5-10 kandidat USP dengan RTB (reason to believe), differentiationScore 0-100, dan risks[]
5. differentiationScore agregat 0-100 untuk keseluruhan peluang kategori
6. aiSummary 3-4 kalimat

Balas JSON:
{
  "gapMatrix": [
    { "claim": "string", "competitors": ["string"], "gapScore": number, "opportunity": "string" }
  ],
  "claimAnalysis": {
    "overused": ["string"],
    "underserved": ["string"]
  },
  "positioningMap": {
    "axisX": "string",
    "axisY": "string",
    "points": [{ "name": "string", "brand": "string", "x": number, "y": number }]
  },
  "uspCandidates": [
    { "usp": "string", "rtb": "string", "differentiationScore": number, "risks": ["string"] }
  ],
  "differentiationScore": number,
  "aiSummary": "string"
}`;
}
