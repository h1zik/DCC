import "server-only";

import { buildActionPlanInstruction } from "@/lib/research/prescriptive/prompt";
import type { StructuredSourceRef } from "@/lib/brand-research/strategy/evidence-types";

export type BrandStrategyEvidenceInput = {
  category?: string;
  brandName?: string;
  sourceRefs: StructuredSourceRef[];
  reviewInsights: {
    sourceId: string;
    productName: string;
    competitorBrand: string;
    positivePct: number;
    negativePct: number;
    topComplaints: string[];
    topPraises: string[];
    gapOpportunity: string | null;
  }[];
  socialInsights: {
    sourceId: string;
    name: string;
    topPainPoints: string[];
    topWishlist: string[];
    aiSummary: string | null;
  }[];
  visualTags: string[];
  visualAssetCount: number;
  visualImageAnalysis?: {
    enabled: boolean;
    sampleCount: number;
    loadedCount: number;
    sampleLabels: string[];
  };
  competitorCopy: {
    sourceId: string;
    name: string;
    brand: string;
    sampleProducts: {
      name: string;
      rating: number | null;
      promoText: string | null;
    }[];
  }[];
  keywordThemes: string[];
  trendSignals: {
    sourceId: string;
    name: string;
    phase: string;
    dimension: string;
    narrative: string | null;
  }[];
  uspInsights: {
    sourceId: string;
    category: string;
    uspCandidates: string[];
    overusedClaims: string[];
    underservedClaims: string[];
    aiSummary: string | null;
  } | null;
};

const RATIONALE_FIELDS = [
  { field: "brandPurpose", label: "Brand Purpose" },
  { field: "brandEssence", label: "Brand Essence" },
  { field: "coreMessage", label: "Core Message" },
  { field: "brandUsp", label: "Brand USP" },
  { field: "stp", label: "STP (Segment, Targeting, Positioning)" },
  { field: "brandPersonality", label: "Brand Personality" },
  { field: "toneOfVoice", label: "Tone of Voice" },
] as const;

export function buildBrandStrategyPrompt(ctx: BrandStrategyEvidenceInput): string {
  const visionNote =
    ctx.visualImageAnalysis?.enabled && ctx.visualImageAnalysis.loadedCount > 0
      ? `
ANALISIS VISUAL (WAJIB):
- ${ctx.visualImageAnalysis.loadedCount} gambar referensi dari Visual Library dilampirkan pada prompt ini.
- Kamu BENAR-BENAR melihat gambar tersebut — jangan hanya mengandalkan visualTags.
- Jelaskan mood, palet warna, komposisi, dan estetika yang terlihat langsung dari gambar.
- Kutip observasi visual spesifik di strategyRationales dan evidenceRefs (source: visual).
`
      : ctx.visualAssetCount > 0
        ? `
CATATAN VISUAL:
- Visual Library hanya disediakan sebagai tags/metadata teks (${ctx.visualAssetCount} asset) — gambar TIDAK dilampirkan.
- Jangan mengklaim melihat gambar; gunakan visualTags dan jelaskan keterbatasan ini bila relevan.
`
        : "";

  return `Kamu adalah Brand Strategist & Creative Director untuk brand beauty/personal care Indonesia.

Tugas: susun BRAND STRATEGY (bukan analisis produk/SKU, bukan harga per ml, bukan spek kemasan).

Konteks brand: ${ctx.brandName ?? "Brand DCC"} · kategori: ${ctx.category ?? "beauty"}
${visionNote}

Sumber data (gunakan sourceId saat mengutip di evidenceRefs):
${JSON.stringify(ctx.sourceRefs, null, 2)}

Data evidence (WAJIB jadi dasar setiap rekomendasi — jangan asumsikan di luar data ini):
${JSON.stringify(
  {
    reviewInsights: ctx.reviewInsights,
    socialInsights: ctx.socialInsights,
    visualTags: ctx.visualTags,
    visualAssetCount: ctx.visualAssetCount,
    visualImageAnalysis: ctx.visualImageAnalysis,
    competitorCopy: ctx.competitorCopy,
    keywordThemes: ctx.keywordThemes,
    trendSignals: ctx.trendSignals,
    uspInsights: ctx.uspInsights,
  },
  null,
  2,
)}

ATURAN KETAT:
- JANGAN fokus pada spesifikasi produk, harga, volume ml, ingredient list sebagai inti strategi.
- Brand USP = diferensiasi EMOSIONAL & RELASIONAL brand (bukan fitur produk).
- STP = Segment, Targeting, Positioning Statement (bukan GO/WATCH kategori produk).
- Tone of Voice = bagaimana brand berbicara ke konsumen.
- Setiap blok strategi WAJIB punya entri di strategyRationales dengan reasoning detail (min. 3 kalimat).
- strategyRationales.reasoning harus menjelaskan: data apa yang dipakai, pola apa yang terlihat, mengapa keputusan ini logis untuk brand ini.
- evidenceRefs.source harus salah satu: review, social, visual, competitor, keyword, trend, usp
- Sertakan sourceId dari sourceRefs bila ada.
- Setiap strategyRationales wajib punya minimal 2 evidenceRefs yang spesifik (bukan generik).

Field rationale yang WAJIB diisi:
${RATIONALE_FIELDS.map((f) => `- ${f.field}: ${f.label}`).join("\n")}

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
  "strategyRationales": [
    {
      "field": "brandPurpose",
      "label": "Brand Purpose",
      "reasoning": "string — 3-6 kalimat detail: data → pola → keputusan",
      "confidence": "high|medium|low",
      "evidenceRefs": [
        { "field": "brandPurpose", "source": "review|social|visual|competitor|keyword|trend|usp", "sourceId": "optional", "snippet": "kutipan data spesifik" }
      ]
    }
  ],
  "evidenceRefs": [
    { "field": "brandPurpose|...", "source": "review|social|visual|competitor|keyword|trend|usp", "sourceId": "string optional", "snippet": "string" }
  ],
  "aiSummary": "string — 2-3 kalimat executive summary untuk creative team"
}`;
}
