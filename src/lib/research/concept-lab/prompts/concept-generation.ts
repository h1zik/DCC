import "server-only";

import type { ConceptContext } from "@/lib/research/concept-lab/gather-concept-context";

/** Versi prompt — naikkan setiap kali instruksi berubah (dicatat di aiMeta). */
export const CONCEPT_GENERATION_PROMPT_VERSION = "2";

export function buildConceptGenerationPrompt(input: {
  category: string;
  targetMarket?: string | null;
  priceTargetMin?: number | null;
  priceTargetMax?: number | null;
  ingredientPreferences?: string | null;
  context: ConceptContext;
}): string {
  return `Kamu adalah product strategist beauty & personal care Indonesia.

Buat konsep produk lengkap berdasarkan input dan data riset berikut.

Kategori: ${input.category}
Target market: ${input.targetMarket ?? "umum Indonesia"}
Budget harga jual: ${
    input.priceTargetMin != null && input.priceTargetMax != null
      ? `Rp ${input.priceTargetMin.toLocaleString("id-ID")} – Rp ${input.priceTargetMax.toLocaleString("id-ID")}`
      : "belum ditentukan"
  }
Preferensi ingredient: ${input.ingredientPreferences ?? "tidak ada"}

Data riset (modul 1–6):
${JSON.stringify(input.context, null, 2)}

ATURAN GROUNDING (WAJIB):
- Gunakan HANYA data riset di atas sebagai dasar klaim pasar/kompetitor. JANGAN
  mengarang angka, statistik, pangsa pasar, atau harga yang tidak ada di data.
- "competitorComparison" dan "whyItWillWin" HARUS mengacu ke tema/keluhan/produk
  yang benar-benar ada di data riset di atas. Bila data modul kosong, tulis
  eksplisit bahwa perbandingan terbatas karena data belum tersedia.
- "heroIngredients[].reason" harus terkait keluhan/tren/keyword di data; bila
  murni pengetahuan umum formulasi, awali dengan "Hipotesis: ".
- JANGAN menyebut nama brand pihak ketiga dalam klaim/copy — rujuk sebagai
  "kompetitor di kategori ini".
- JANGAN memberi estimasi biaya produksi (COGS/HPP) — itu wewenang quote
  manufaktur, bukan model AI.

Balas JSON:
{
  "nameOptions": ["string", "string", "string"],
  "positioningStatement": "string",
  "heroIngredients": [{ "name": "string", "reason": "string" }],
  "textureFormat": "string",
  "keyClaims": ["string"],
  "packagingDirection": "string",
  "competitorComparison": "string",
  "whyItWillWin": "string"
}`;
}
