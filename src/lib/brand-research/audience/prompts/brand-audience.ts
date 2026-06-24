import "server-only";

import { buildActionPlanInstruction } from "@/lib/research/prescriptive/prompt";
import { buildBrandGuardInstruction } from "@/lib/research/brand-guard";
import type { BrandStrategyEvidenceInput } from "@/lib/brand-research/strategy/prompts/brand-strategy";

/** Hasil sintesis persona dari AI. */
export type AudiencePersona = {
  name: string;
  archetype: string;
  /** Ringkas: rentang usia, gender, lokasi, lifestyle. */
  demographics: string;
  painPoints: string[];
  /** Harapan / aspirasi yang ingin dicapai konsumen. */
  hopes: string[];
  motivations: {
    functional: string[];
    emotional: string[];
    social: string[];
  };
  habits: {
    /** Kanal tempat mereka mencari info & berbelanja. */
    channels: string[];
    /** Pemicu yang mendorong keputusan beli. */
    triggers: string[];
    /** Narasi pola pembelian (frekuensi, momen, sensitivitas harga). */
    buyingBehavior: string;
    /** Faktor utama saat memutuskan beli. */
    decisionFactors: string[];
  };
  representativeQuotes: {
    text: string;
    source: "review" | "social";
  }[];
  /** Estimasi porsi audiens (opsional, mis. "~40% pembeli"). */
  shareOfAudience?: string;
};

export type AudienceResult = {
  personas: AudiencePersona[];
  aiSummary: string;
  actionPlan?: unknown;
  evidenceRefs?: unknown[];
};

export function buildBrandAudiencePrompt(
  ctx: BrandStrategyEvidenceInput,
  forbiddenBrands: string[],
): string {
  const demoNote =
    ctx.demoFlags.length > 0
      ? `
PERINGATAN DATA DEMO (turunkan confidence, jangan over-claim):
${ctx.demoFlags.map((f) => `- ${f.label}: ${f.detail}`).join("\n")}
`
      : "";

  const pmBriefNote = ctx.pmBrief?.trim()
    ? `
BRIEF PM (constraint — hormati saat menyusun persona):
${ctx.pmBrief.trim()}
`
    : "";

  const portfolioNote =
    ctx.portfolioLines.length > 0
      ? `
BRAND PORTFOLIO (produk yang dijual — selaraskan persona dengan ini):
Ringkasan: ${ctx.portfolioSummary?.trim() || "(tidak ada ringkasan)"}
${JSON.stringify(ctx.portfolioLines, null, 2)}
`
      : "";

  return `Kamu adalah Consumer Insight Researcher untuk brand beauty/personal care Indonesia.

Tugas: dari evidence "voice of customer" di bawah, rumuskan 2-4 PERSONA target market brand ini.
Setiap persona harus menjelaskan APA YANG MEMOTIVASI mereka membeli produk — bukan sekadar demografi.

Konteks brand: ${ctx.brandName ?? "Brand DCC"} · kategori: ${ctx.category ?? "beauty"}
${pmBriefNote}${portfolioNote}${demoNote}
${buildBrandGuardInstruction({ forbiddenBrands })}

Sumber data (gunakan sourceId saat mengutip di evidenceRefs):
${JSON.stringify(ctx.sourceRefs, null, 2)}

Evidence mentah voice-of-customer:
${JSON.stringify(
  {
    reviewInsights: ctx.reviewInsights,
    socialInsights: ctx.socialInsights,
    representativeQuotes: ctx.representativeQuotes,
    competitorSignals: ctx.competitorSignals,
    keywordThemes: ctx.keywordThemes,
    trendSignals: ctx.trendSignals,
    uspInsights: ctx.uspInsights,
    portfolioLines: ctx.portfolioLines,
  },
  null,
  2,
)}

ATURAN KETAT:
- Buat 2-4 persona berbeda yang benar-benar tercermin dari data (jangan mengarang segmen tanpa bukti).
- Tiap persona WAJIB punya keempat dimensi: painPoints, hopes, motivations, habits.
- motivations dipecah menjadi functional (manfaat fungsional), emotional (perasaan/identitas), dan social (pengakuan/komunitas).
- habits.buyingBehavior = narasi 1-2 kalimat pola beli (frekuensi, momen pemicu, sensitivitas harga).
- representativeQuotes WAJIB diambil dari representativeQuotes pada evidence (boleh diringkas) — jangan mengarang kutipan.
- Jika data tipis untuk sebuah dimensi, isi seadanya dari bukti dan turunkan klaim — jangan memaksakan.
- Jangan menyebut nama brand kompetitor dalam copy persona.

${buildActionPlanInstruction(["BRAND", "MARKETING"], forbiddenBrands)}

Balas HANYA JSON valid:
{
  "personas": [
    {
      "name": "string — nama panggilan persona, mis. 'Hijabers Pragmatis'",
      "archetype": "string — arketipe singkat",
      "demographics": "string — usia, gender, lokasi, lifestyle ringkas",
      "painPoints": ["string"],
      "hopes": ["string"],
      "motivations": {
        "functional": ["string"],
        "emotional": ["string"],
        "social": ["string"]
      },
      "habits": {
        "channels": ["string"],
        "triggers": ["string"],
        "buyingBehavior": "string",
        "decisionFactors": ["string"]
      },
      "representativeQuotes": [
        { "text": "string — kutipan dari evidence", "source": "review|social" }
      ],
      "shareOfAudience": "string opsional"
    }
  ],
  "evidenceRefs": [
    { "field": "persona", "source": "review|social|competitor|keyword|trend|usp|portfolio", "sourceId": "string optional", "snippet": "kutipan data spesifik min 12 karakter" }
  ],
  "actionPlan": {
    "headline": "string",
    "recommendations": [
      {
        "owner": "BRAND|MARKETING",
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
  "aiSummary": "string — 2-3 kalimat ringkasan lintas-persona untuk tim brand & marketing"
}`;
}
