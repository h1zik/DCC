import "server-only";

import { buildBrandGuardInstruction } from "@/lib/research/brand-guard";
import type { ConceptContext } from "@/lib/research/concept-lab/gather-concept-context";
import type { RiskFactor } from "@/lib/research/concept-lab/types";
import { SCAMPER_TECHNIQUES } from "@/lib/research/product-innovation/types";

export function buildScamperPrompt(input: {
  baseProduct: string;
  category: string;
  targetMarket?: string | null;
  priceTargetMin?: number | null;
  priceTargetMax?: number | null;
  context: ConceptContext;
  riskFactors: RiskFactor[];
  forbiddenBrands: string[];
}): string {
  const budget =
    input.priceTargetMin != null && input.priceTargetMax != null
      ? `Rp ${input.priceTargetMin.toLocaleString("id-ID")} – Rp ${input.priceTargetMax.toLocaleString("id-ID")}`
      : "belum ditentukan";

  const techniqueGuide = SCAMPER_TECHNIQUES.map(
    (t) => `- ${t.key} (${t.label}): ${t.hint}`,
  ).join("\n");

  const riskNote =
    input.riskFactors.length > 0
      ? `
FAKTOR RISIKO PASAR (dari evidence — manfaatkan untuk inovasi yang menjawab keluhan nyata):
${input.riskFactors.map((r) => `- [${r.severity}] ${r.label} (${r.source.module})`).join("\n")}
`
      : "";

  return `Kamu adalah product innovation strategist untuk beauty & personal care Indonesia.

Terapkan metode SCAMPER pada PRODUK BASIS untuk menghasilkan alternatif inovasi yang konkret dan berbasis bukti pasar.

PRODUK BASIS: ${input.baseProduct}
Kategori: ${input.category}
Target market: ${input.targetMarket ?? "umum Indonesia"}
Budget harga jual: ${budget}

6 LENSA SCAMPER (hasilkan 1-2 alternatif untuk SETIAP lensa):
${techniqueGuide}
${riskNote}
${buildBrandGuardInstruction({ forbiddenBrands: input.forbiddenBrands })}

DATA RISET (gunakan untuk rationale — jangan mengarang tren/keluhan):
${JSON.stringify(input.context, null, 2)}

ATURAN KETAT:
- Hasilkan minimal 1, idealnya 2, alternatif untuk SETIAP dari 6 lensa SCAMPER (total 6-12 ide).
- Tiap ide harus KONKRET (bukan slogan): jelaskan perubahan nyata dari produk basis.
- rationale WAJIB merujuk pola dari DATA RISET (keluhan, gap, tren, keyword, atau pain point sosial) — bukan klaim generik.
- Jangan menyebut nama brand kompetitor dalam copy ide.
- benefit = manfaat utama bagi konsumen; feasibilityNote = catatan kelayakan/eksekusi singkat.

Balas HANYA JSON valid:
{
  "ideas": [
    {
      "technique": "SUBSTITUTE|COMBINE|ADAPT|PUT_TO_OTHER_USE|ELIMINATE|REVERSE_REARRANGE",
      "title": "string — nama ide singkat",
      "description": "string — deskripsi inovasi 1-2 kalimat",
      "rationale": "string — kenapa relevan, rujuk data riset spesifik",
      "change": "string — perubahan konkret dari produk basis",
      "benefit": "string — manfaat utama bagi konsumen",
      "feasibilityNote": "string — catatan kelayakan/eksekusi"
    }
  ],
  "aiSummary": "string — 2-3 kalimat arah inovasi paling menjanjikan"
}`;
}
