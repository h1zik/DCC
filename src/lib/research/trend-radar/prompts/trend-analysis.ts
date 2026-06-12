import type { CollectedTrendRaw } from "@/lib/research/trend-radar/collect-sources";

export function buildTrendAnalysisPrompt(input: {
  signals: CollectedTrendRaw["signals"];
  watchlistName?: string;
  seedKeywords?: string[];
}): string {
  const payload = input.signals.slice(0, 80);

  return `Kamu adalah analis tren kosmetik & beauty Indonesia.
${input.watchlistName ? `Watchlist: "${input.watchlistName}"` : "Digest tren global mingguan."}
${input.seedKeywords?.length ? `Seed keywords: ${input.seedKeywords.join(", ")}` : ""}

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
- relatedProducts: contoh produk di pasar

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
