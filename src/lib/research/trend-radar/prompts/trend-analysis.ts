import type { CollectedTrendRaw } from "@/lib/research/trend-radar/collect-sources";
import { buildActionPlanInstruction } from "@/lib/research/prescriptive/prompt";
import { buildBrandGuardInstruction } from "@/lib/research/brand-guard";

export function buildTrendActionPlanPrompt(input: {
  narrative: string;
  items: { name: string; dimension: string; phase: string; score: number }[];
  forbiddenBrands?: string[];
}): string {
  return `Kamu adalah strateg produk beauty Indonesia.
Berdasarkan tren minggu ini, buat rencana aksi konkret.

Ringkasan: ${input.narrative}
Tren: ${input.items
    .map((i) => `${i.name} [${i.dimension}/${i.phase}, score ${i.score.toFixed(2)}]`)
    .join("; ")}

Pedoman fase->aksi: EMERGING = eksplorasi/early bet R&D; GROWING = percepat masuk pasar & marketing; PEAK = diferensiasi/hindari me-too; DECLINING = hindari investasi baru / phase-out.

${buildBrandGuardInstruction({ forbiddenBrands: input.forbiddenBrands ?? [] })}

${buildActionPlanInstruction(["RND", "MARKETING", "BRAND"], input.forbiddenBrands)}

Balas HANYA JSON valid:
{ "actionPlan": { "headline": "string", "recommendations": [ /* skema di atas */ ] } }`;
}

export function buildTrendAnalysisPrompt(input: {
  signals: CollectedTrendRaw["signals"];
  watchlistName?: string;
  seedKeywords?: string[];
  forbiddenBrands?: string[];
}): string {
  const payload = input.signals.slice(0, 80);

  return `Kamu adalah analis tren kosmetik & beauty Indonesia.
${input.watchlistName ? `Watchlist: "${input.watchlistName}"` : "Digest tren global mingguan."}
${input.seedKeywords?.length ? `Seed keywords: ${input.seedKeywords.join(", ")}` : ""}

${buildBrandGuardInstruction({ forbiddenBrands: input.forbiddenBrands ?? [] })}

Data sinyal mentah dari berbagai sumber:
${JSON.stringify(payload)}

Identifikasi 8-12 TREN MAKRO (bukan daftar keyword mentah).
PENTING: Jangan buat 1 tren per keyword Google Trends. Gabungkan keyword serupa jadi satu tren
(contoh: "ceramide", "5x ceramide", "moisturizer ceramide" → satu tren "Ceramide barrier").

Klasifikasikan setiap tren:
- dimension: INGREDIENT | CLAIM | CATEGORY | FORMAT | BRAND
- phase — WAJIB bervariasi, gunakan kriteria ini:
  • EMERGING: query rising / bahan baru / belum mainstream di Indonesia
  • GROWING: minat naik, belum saturasi, masih ada ruang brand
  • PEAK: volume sangat tinggi, sudah ramai SKU, mainstream (contoh: ceramide, niacinamide jika sudah dominan)
  • DECLINING: interes melambat atau digantikan tren baru (contoh: format/klaim lama)
  Target distribusi: ~2 Emerging, ~3 Growing, ~2 Peak, ~1 Declining (sesuaikan data)
- score: 0-1 (confidence)
- isGlobalPipeline: true jika tren global mulai masuk Indonesia
- narrative: 1-2 kalimat Bahasa Indonesia
- sources: [{ type, snippet, url? }]
- relatedProducts: contoh produk GENERIK di pasar (mis. "serum niacinamide 10%") — TANPA nama brand kompetitor

Gunakan field meta.rising=true pada sinyal sebagai petunjuk EMERGING.
Gunakan meta.value tertinggi sebagai petunjuk PEAK.

Juga tulis narrative ringkasan mingguan (3-4 kalimat Bahasa Indonesia).

Balas HANYA JSON:
{
  "narrative": "string",
  "items": [{
    "name": "string",
    "dimension": "INGREDIENT"|"CLAIM"|"CATEGORY"|"FORMAT"|"BRAND",
    "phase": "EMERGING"|"GROWING"|"PEAK"|"DECLINING",
    "score": number,
    "narrative": "string",
    "isGlobalPipeline": boolean,
    "sources": [{ "type": "string", "snippet": "string", "url": "string?" }],
    "relatedProducts": ["string"]
  }]
}`;
}
