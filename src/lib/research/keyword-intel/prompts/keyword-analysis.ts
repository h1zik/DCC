import type { RawKeywordSignal } from "@/lib/research/keyword-intel/collect-keywords";

export function buildKeywordAnalysisPrompt(input: {
  category: string;
  seedKeyword?: string | null;
  signals: RawKeywordSignal[];
}): string {
  const payload = input.signals.slice(0, 60).map((s) => ({
    keyword: s.keyword,
    volume: s.volume ?? 0,
    competition: s.competition ?? 0.5,
    trend: s.trend ?? "stable",
    sources: s.sources,
  }));

  return `Kamu adalah ahli SEO marketplace kosmetik & bodycare Indonesia.
Analisis keyword untuk kategori: "${input.category}"${input.seedKeyword ? ` (seed: ${input.seedKeyword})` : ""}.

Data keyword mentah:
${JSON.stringify(payload)}

Tugas:
1. keywordMatrix — perkaya setiap keyword dengan intent ("transactional" | "informational") dan pastikan volume/competition/trend konsisten
2. gapKeywords — 5-10 keyword high demand + low competition (volume tinggi, competition < 0.5)
3. namingSuggestions — 3 nama produk yang SEO-friendly
4. copyKeywords — object dengan keys: listingTitle, listingDescription, socialMedia (masing-masing array 5-8 keyword/frasa)
5. seasonalCalendar — 12 bulan (Jan-Des) dengan peak keywords per bulan (array string)
6. clusters — kelompokkan by intent/tema: [{ name, keywords: string[] }]
7. aiSummary — 2-3 kalimat insight utama Bahasa Indonesia

Balas HANYA JSON valid:
{
  "keywordMatrix": [{ "keyword": "string", "volume": number, "competition": number, "trend": "up"|"down"|"stable", "intent": "transactional"|"informational", "source": string[] }],
  "gapKeywords": [{ "keyword": "string", "volume": number, "competition": number, "reason": "string" }],
  "namingSuggestions": ["string"],
  "copyKeywords": { "listingTitle": string[], "listingDescription": string[], "socialMedia": string[] },
  "seasonalCalendar": [{ "month": "Jan"|"Feb"|...|"Des", "keywords": string[] }],
  "clusters": [{ "name": "string", "keywords": string[] }],
  "aiSummary": "string"
}`;
}
