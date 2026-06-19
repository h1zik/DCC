import "server-only";

import { buildActionPlanInstruction } from "@/lib/research/prescriptive/prompt";

export type BrandStrategyEvidenceInput = {
  category?: string;
  brandName?: string;
  reviewInsights: {
    productName: string;
    competitorBrand: string;
    positivePct: number;
    negativePct: number;
    topComplaints: string[];
    topPraises: string[];
    gapOpportunity: string | null;
  }[];
  socialInsights: {
    name: string;
    topPainPoints: string[];
    topWishlist: string[];
    aiSummary: string | null;
  }[];
  visualTags: string[];
  competitorCopy: { name: string; brand: string; sampleProducts: string[] }[];
  keywordThemes: string[];
};

export function buildBrandStrategyPrompt(ctx: BrandStrategyEvidenceInput): string {
  return `Kamu adalah Brand Strategist & Creative Director untuk brand beauty/personal care Indonesia.

Tugas: susun BRAND STRATEGY (bukan analisis produk/SKU, bukan harga per ml, bukan spek kemasan).

Konteks brand: ${ctx.brandName ?? "Brand DCC"} · kategori: ${ctx.category ?? "beauty"}

Data evidence (gunakan sebagai bukti, kutip di evidenceRefs):
${JSON.stringify(ctx, null, 2)}

ATURAN KETAT:
- JANGAN fokus pada spesifikasi produk, harga, volume ml, ingredient list sebagai inti strategi.
- Brand USP = diferensiasi EMOSIONAL & RELASIONAL brand (bukan fitur produk).
- STP = Segment, Targeting, Positioning Statement (bukan GO/WATCH kategori produk).
- Tone of Voice = bagaimana brand berbicara ke konsumen.
- Setiap blok strategi harus punya evidenceRefs (array string singkat mengutip sumber data).

${buildActionPlanInstruction(["BRAND", "MARKETING"])}

Balas HANYA JSON valid:
{
  "brandPurpose": "string — mengapa brand ada",
  "brandEssence": "string — inti satu kalimat",
  "coreMessage": "string — pesan inti yang konsisten",
  "brandUsp": "string — USP branding (bukan produk)",
  "stp": {
    "segment": "string",
    "targeting": "string",
    "positioningStatement": "string"
  },
  "brandPersonality": {
    "archetype": "string",
    "traits": ["string"],
    "antiTraits": ["string"]
  },
  "toneOfVoice": {
    "principles": ["string"],
    "doExamples": ["string"],
    "dontExamples": ["string"]
  },
  "evidenceRefs": [
    { "field": "brandPurpose|...", "source": "review|social|visual|competitor", "snippet": "string" }
  ],
  "aiSummary": "string — 2-3 kalimat executive summary untuk creative team"
}`;
}
