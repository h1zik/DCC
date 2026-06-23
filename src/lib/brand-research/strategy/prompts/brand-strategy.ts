import "server-only";

import { buildActionPlanInstruction } from "@/lib/research/prescriptive/prompt";
import { buildBrandGuardInstruction } from "@/lib/research/brand-guard";
import type { DemoFlag, InsightMemo, StructuredSourceRef } from "@/lib/brand-research/strategy/evidence-types";
import type { ComputedPalette } from "@/lib/brand-research/visual";
import type { PortfolioLineEvidence } from "@/lib/brand-research/strategy/evidence-types";
import type { ProductDiscoveryEvidence } from "@/lib/brand-research/strategy/product-discovery-evidence";
import type { CompetitorProductEvidence } from "@/lib/research/evidence/competitor-product-evidence";

export type BrandStrategyEvidenceInput = {
  category?: string;
  pmBrief?: string;
  brandName?: string;
  demoFlags: DemoFlag[];
  portfolioSummary?: string | null;
  portfolioLines: PortfolioLineEvidence[];
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
  representativeQuotes: {
    source: "review" | "social";
    sourceId: string;
    text: string;
    sentiment: "positive" | "negative" | "neutral";
  }[];
  visualTags: string[];
  visualTrendTags: string[];
  dominantPalette: ComputedPalette | null;
  visualAssetCount: number;
  visualImageAnalysis?: {
    enabled: boolean;
    sampleCount: number;
    loadedCount: number;
    sampleLabels: string[];
  };
  competitorSignals: {
    sourceId: string;
    brand: string;
    name: string;
    skuCount: number;
    avgRating: number | null;
    positioningThemes: string[];
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
  }[];
  productDiscoveryInsights: ProductDiscoveryEvidence[];
  competitorProductInsights: CompetitorProductEvidence[];
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

export function buildBrandStrategyPrompt(
  ctx: BrandStrategyEvidenceInput,
  insightMemo: InsightMemo,
  forbiddenBrands: string[],
): string {
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
- Visual Library disediakan sebagai tags/metadata + palet agregat (${ctx.visualAssetCount} asset) — gambar TIDAK dilampirkan kecuali dinyatakan lain.
- Gunakan visualTags, visualTrendTags, dominantPalette, dan insightMemo.visualDirection.
`
        : "";

  const demoNote =
    ctx.demoFlags.length > 0
      ? `
PERINGATAN DATA DEMO (pertimbangkan di confidence, jangan over-claim):
${ctx.demoFlags.map((f) => `- ${f.label}: ${f.detail}`).join("\n")}
`
      : "";

  const pmBriefNote = ctx.pmBrief?.trim()
    ? `
BRIEF PM (constraint kreatif — hormati saat menyusun strategi):
${ctx.pmBrief.trim()}
`
    : "";

  const portfolioNote =
    ctx.portfolioLines.length > 0
      ? `
BRAND PORTFOLIO (WAJIB — fondasi lini produk yang akan dijual):
Ringkasan: ${ctx.portfolioSummary?.trim() || "(tidak ada ringkasan)"}
Lini produk:
${JSON.stringify(ctx.portfolioLines, null, 2)}

- Brand strategy harus menyatukan SEMUA lini di atas dalam satu arah branding.
- Hasilkan productLineStrategy untuk SETIAP lini di portfolio.
- Jika lini punya Product Discovery terhubung, gunakan productDiscoveryInsights yang relevan.
- Gunakan competitorProductInsights untuk benchmark harga, rating, promo, dan top produk rival individual (bukan hanya shop-level).
`
      : "";

  return `Kamu adalah Brand Strategist & Creative Director untuk brand beauty/personal care Indonesia.

Tugas STEP 2: susun BRAND STRATEGY final berdasarkan INSIGHT MEMO, BRAND PORTFOLIO, dan evidence mentah.
Fokus pada arah branding menyeluruh; hindari spek teknis (ml, ingredient list) sebagai inti strategi.

Konteks brand: ${ctx.brandName ?? "Brand DCC"} · kategori: ${ctx.category ?? "beauty"}
${pmBriefNote}${portfolioNote}${demoNote}${visionNote}

${buildBrandGuardInstruction({ forbiddenBrands })}

INSIGHT MEMO (hasil analisis Step 1 — gunakan sebagai lensa utama):
${JSON.stringify(insightMemo, null, 2)}

Sumber data (gunakan sourceId saat mengutip di evidenceRefs):
${JSON.stringify(ctx.sourceRefs, null, 2)}

Data evidence mentah (untuk kutipan spesifik):
${JSON.stringify(
  {
    reviewInsights: ctx.reviewInsights,
    socialInsights: ctx.socialInsights,
    representativeQuotes: ctx.representativeQuotes,
    visualTags: ctx.visualTags,
    visualTrendTags: ctx.visualTrendTags,
    dominantPalette: ctx.dominantPalette,
    competitorSignals: ctx.competitorSignals,
    keywordThemes: ctx.keywordThemes,
    trendSignals: ctx.trendSignals,
    uspInsights: ctx.uspInsights,
    productDiscoveryInsights: ctx.productDiscoveryInsights,
    competitorProductInsights: ctx.competitorProductInsights,
    portfolioLines: ctx.portfolioLines,
  },
  null,
  2,
)}

ATURAN KETAT:
- JANGAN fokus pada spesifikasi produk, harga, volume ml, ingredient list sebagai inti strategi.
- Brand USP = diferensiasi EMOSIONAL & RELASIONAL brand (bukan fitur produk).
- STP = Segment, Targeting, Positioning Statement untuk brand secara keseluruhan.
- productLineStrategy: satu entri per lini portfolio — positioning, key message, differentiator per lini.
- Tone of Voice = bagaimana brand berbicara ke konsumen.
- strategicTensions: salin dari insight memo, sesuaikan jika perlu dengan bukti tambahan.
- Setiap blok strategi WAJIB punya entri di strategyRationales dengan reasoning detail (min. 3 kalimat).
- strategyRationales.reasoning harus menjelaskan: data apa yang dipakai, pola apa yang terlihat, mengapa keputusan ini logis untuk brand ini.
- evidenceRefs.source harus salah satu: review, social, visual, competitor, keyword, trend, usp, product-discovery, competitor-product, portfolio
- Sertakan sourceId dari sourceRefs bila ada.
- Setiap strategyRationales wajib punya minimal 2 evidenceRefs yang spesifik (bukan generik).

Field rationale yang WAJIB diisi:
${RATIONALE_FIELDS.map((f) => `- ${f.field}: ${f.label}`).join("\n")}

${buildActionPlanInstruction(["BRAND", "MARKETING"], forbiddenBrands)}

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
  "strategicTensions": [
    { "tension": "string", "poleA": "string", "poleB": "string", "recommendation": "string" }
  ],
  "productLineStrategy": [
    {
      "lineId": "string optional — dari portfolio",
      "lineName": "string",
      "role": "HERO|CORE|FLANKER|EXPERIMENTAL",
      "category": "string",
      "positioning": "string — peran lini dalam portfolio",
      "keyMessage": "string — pesan utama lini ini",
      "differentiator": "string — apa yang membedakan lini ini dalam brand",
      "targetAudience": "string",
      "portfolioFit": "string — bagaimana lini ini selaras dengan brand umbrella"
    }
  ],
  "strategyRationales": [
    {
      "field": "brandPurpose",
      "label": "Brand Purpose",
      "reasoning": "string — 3-6 kalimat detail: data → pola → keputusan",
      "confidence": "high|medium|low",
      "evidenceRefs": [
        { "field": "brandPurpose", "source": "review|social|visual|competitor|keyword|trend|usp|product-discovery|competitor-product|portfolio", "sourceId": "optional", "snippet": "kutipan data spesifik min 12 karakter" }
      ]
    }
  ],
  "evidenceRefs": [
    { "field": "brandPurpose|...", "source": "review|social|visual|competitor|keyword|trend|usp|product-discovery|competitor-product|portfolio", "sourceId": "string optional", "snippet": "string" }
  ],
  "actionPlan": {
    "headline": "string",
    "recommendations": [
      {
        "owner": "BRAND|MARKETING|RND|PRICING|FINANCE|SUPPLY",
        "priority": "P0|P1|P2",
        "action": "string",
        "rationale": "string",
        "evidence": [{ "module": "string", "label": "string" }],
        "expectedImpact": "string",
        "metricToWatch": "string",
        "confidence": 0.8,
        "effort": "LOW|MED|HIGH",
        "horizon": "NOW|30D|QUARTER"
      }
    ]
  },
  "aiSummary": "string — 2-3 kalimat executive summary untuk creative team"
}`;
}

const SECTION_LABELS: Record<string, string> = {
  brandPurpose: "Brand Purpose",
  brandEssence: "Brand Essence",
  coreMessage: "Core Message",
  brandUsp: "Brand USP",
  stp: "STP",
  brandPersonality: "Brand Personality",
  toneOfVoice: "Tone of Voice",
};

export function buildBrandStrategySectionPrompt(
  field: string,
  ctx: BrandStrategyEvidenceInput,
  insightMemo: InsightMemo,
  currentDocument: Record<string, unknown>,
  forbiddenBrands: string[],
): string {
  const label = SECTION_LABELS[field] ?? field;

  return `Kamu adalah Brand Strategist untuk brand beauty/personal care Indonesia.

Regenerasi SATU bagian strategi saja: "${label}" (field: ${field}).

Konteks brand: ${ctx.brandName ?? "Brand DCC"} · kategori: ${ctx.category ?? "beauty"}

${buildBrandGuardInstruction({ forbiddenBrands })}

INSIGHT MEMO:
${JSON.stringify(insightMemo, null, 2)}

Dokumen strategi saat ini (jangan ubah bagian lain):
${JSON.stringify(currentDocument, null, 2)}

Evidence mentah:
${JSON.stringify(
  {
    reviewInsights: ctx.reviewInsights,
    socialInsights: ctx.socialInsights,
    representativeQuotes: ctx.representativeQuotes,
    visualTags: ctx.visualTags,
    competitorSignals: ctx.competitorSignals,
    keywordThemes: ctx.keywordThemes,
    trendSignals: ctx.trendSignals,
    uspInsights: ctx.uspInsights,
    productDiscoveryInsights: ctx.productDiscoveryInsights,
    competitorProductInsights: ctx.competitorProductInsights,
    portfolioLines: ctx.portfolioLines,
  },
  null,
  2,
)}

Sumber kutipan valid:
${JSON.stringify(ctx.sourceRefs, null, 2)}

Aturan:
- Hanya regenerasi field "${field}" dan strategyRationales untuk field tersebut.
- reasoning min. 3 kalimat dengan minimal 2 evidenceRefs spesifik.
- Jangan menyebut brand kompetitor di copy strategi.

Balas HANYA JSON:
{
  "field": "${field}",
  "value": <nilai field sesuai tipe — string untuk brandPurpose, object untuk stp/personality/tone>,
  "rationale": {
    "field": "${field}",
    "label": "${label}",
    "reasoning": "string",
    "confidence": "high|medium|low",
    "evidenceRefs": [{ "field": "${field}", "source": "review|social|visual|competitor|keyword|trend|usp|product-discovery|competitor-product|portfolio", "sourceId": "optional", "snippet": "string" }]
  }
}`;
}
