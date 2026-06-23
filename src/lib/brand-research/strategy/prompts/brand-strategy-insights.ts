import "server-only";

import type { BrandStrategyEvidenceInput } from "@/lib/brand-research/strategy/prompts/brand-strategy";

export function buildBrandStrategyInsightPrompt(ctx: BrandStrategyEvidenceInput): string {
  const demoNote =
    ctx.demoFlags.length > 0
      ? `
PERINGATAN DATA DEMO:
${ctx.demoFlags.map((f) => `- ${f.label}: ${f.detail}`).join("\n")}
Catat peringatan ini di demoDataWarnings pada output.
`
      : "";

  const pmBriefNote = ctx.pmBrief?.trim()
    ? `
BRIEF PM (prioritaskan constraint ini saat menafsirkan data):
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

- Insight memo harus mempertimbangkan SEMUA lini produk di atas.
- Identifikasi thread branding yang menyatukan portfolio multi-produk.
`
      : "";

  return `Kamu adalah Senior Market Research Analyst untuk brand beauty/personal care Indonesia.

Tugas STEP 1: susun INSIGHT MEMO — rangkuman evidence sebelum Brand Strategist menyusun dokumen strategi.
JANGAN tulis brand purpose, STP, atau tone of voice final di step ini.

Konteks brand: ${ctx.brandName ?? "Brand DCC"} · kategori: ${ctx.category ?? "beauty"}
${pmBriefNote}${portfolioNote}${demoNote}

Sumber data (gunakan sourceId saat merujuk kutipan):
${JSON.stringify(ctx.sourceRefs, null, 2)}

Data evidence mentah:
${JSON.stringify(
  {
    reviewInsights: ctx.reviewInsights,
    socialInsights: ctx.socialInsights,
    representativeQuotes: ctx.representativeQuotes,
    visualTags: ctx.visualTags,
    visualTrendTags: ctx.visualTrendTags,
    dominantPalette: ctx.dominantPalette,
    visualAssetCount: ctx.visualAssetCount,
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

ATURAN:
- Fokus pada POLA dan TENSI pasar, bukan rekomendasi produk/SKU.
- representativeQuotes: pilih 4-8 kutipan paling representatif dari data (boleh dari input representativeQuotes).
- strategicTensions: 2-4 pas tension (poleA vs poleB) yang brand harus navigasi, dengan rekomendasi arah.
- competitiveWhitespace: celah positioning/emosi yang belum diisi kompetitor (bukan gap SKU).
- aestheticNotes: arah visual dari palette + tags (bukan daftar produk).

Balas HANYA JSON valid:
{
  "executiveSummary": "string — 3-5 kalimat ringkasan evidence",
  "voiceOfCustomer": {
    "pains": ["string"],
    "desires": ["string"],
    "representativeQuotes": [
      { "source": "review|social", "sourceId": "string", "text": "string", "sentiment": "positive|negative|neutral" }
    ]
  },
  "visualDirection": {
    "palette": { "primary": "#hex", "secondary": "#hex", "accent": "#hex", "neutrals": ["#hex"] } | null,
    "topTags": ["string"],
    "aestheticNotes": "string"
  },
  "marketContext": {
    "keywordThemes": ["string"],
    "trendSignals": ["string"],
    "competitiveWhitespace": ["string"]
  },
  "strategicTensions": [
    { "tension": "string", "poleA": "string", "poleB": "string", "recommendation": "string" }
  ],
  "demoDataWarnings": ["string"]
}`;
}
