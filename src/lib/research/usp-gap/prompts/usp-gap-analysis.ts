import "server-only";

import { buildActionPlanInstruction } from "@/lib/research/prescriptive/prompt";
import type { UspGatheredContext } from "@/lib/research/usp-gap/gather-context";

export function buildUspGapAnalysisPrompt(ctx: UspGatheredContext): string {
  return `Kamu adalah strateg produk beauty & personal care Indonesia.

Analisis kategori: "${ctx.category}"

Data agregat dari modul riset:
${JSON.stringify(ctx, null, 2)}

Panduan modul:
- productDiscovery: landscape marketplace (price band, top seller, promo share, brand breakdown)
- competitorProducts: benchmark produk individual yang dilacak user (harga, rating, sold, promo per SKU rival)
- competitor: data shop-level dari Competitor Tracker (SKU agregat per toko)
- competitor.claims: token TENTATIF hasil pemecahan judul SKU, BUKAN klaim terverifikasi — perlakukan sebagai sinyal lemah, jangan jadikan bukti utama.

Tugas:
1. Buat gap matrix: klaim/benefit vs kekosongan pasar. Per baris WAJIB isi:
   - gapScore 0-100, opportunity ringkas
   - recommendedAction: aksi imperatif konkret untuk merebut gap
   - priority: "P0" | "P1" | "P2" (P0 = gap besar & mudah dimenangkan)
   - evidenceRefs: array string yang HARUS mengutip teks/tema/keyword yang benar-benar ada di data JSON di atas — jangan mengarang bukti
2. Claim analysis: klaim overused vs masih kosong di pasar (hanya dari data, bukan asumsi)
3. Positioning map: axisX default "Harga", axisY default "Efektivitas/Benefit", plot 5-12 poin kompetitor/kategori — koordinat x/y harus konsisten dengan range harga & benefit di data competitor bila tersedia
4. 5-10 kandidat USP dengan RTB (reason to believe), differentiationScore 0-100, dan risks[]
5. differentiationScore agregat 0-100 untuk keseluruhan peluang kategori
6. categoryDecision: keputusan masuk kategori — verdict "GO" | "WATCH" | "AVOID", confidence 0..1, dan reason ringkas berbasis bukti
7. aiSummary 3-4 kalimat

${buildActionPlanInstruction(["RND", "MARKETING", "BRAND", "PRICING"])}

Balas JSON:
{
  "gapMatrix": [
    { "claim": "string", "competitors": ["string"], "gapScore": number, "opportunity": "string",
      "recommendedAction": "string", "priority": "P0"|"P1"|"P2", "evidenceRefs": ["string"] }
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
  "categoryDecision": { "verdict": "GO"|"WATCH"|"AVOID", "confidence": number, "reason": "string" },
  "aiSummary": "string",
  "actionPlan": { "headline": "string", "recommendations": [ /* skema di atas */ ] }
}`;
}
