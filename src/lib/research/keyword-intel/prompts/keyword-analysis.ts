import type { RawKeywordSignal } from "@/lib/research/keyword-intel/collect-keywords";
import type { GapKeywordBase } from "@/lib/research/keyword-intel/build-keyword-output";

export function buildKeywordAnalysisPrompt(input: {
  category: string;
  seedKeyword?: string | null;
  signals: RawKeywordSignal[];
  gapCandidates: GapKeywordBase[];
}): string {
  const payload = input.signals.slice(0, 60).map((s) => ({
    keyword: s.keyword,
    volume: s.volume ?? null,
    competition: s.competition ?? null,
    trend: s.trend ?? null,
    sources: s.sources,
  }));

  const gapList = input.gapCandidates.map((g) => g.keyword);

  return `Kamu adalah ahli SEO marketplace kosmetik & bodycare Indonesia.
Analisis keyword untuk kategori: "${input.category}"${input.seedKeyword ? ` (seed: ${input.seedKeyword})` : ""}.

PENTING:
- Volume & kompetisi SUDAH dari DataForSEO — JANGAN mengarang angka baru.
- JANGAN menambah keyword baru di luar daftar mentah.
- keywordMatrix dan gapKeywords dengan angka volume TIDAK perlu kamu buat — sistem yang mengisi.

Data keyword mentah:
${JSON.stringify(payload)}

Keyword gap kandidat (hanya beri alasan singkat per item):
${gapList.length > 0 ? JSON.stringify(gapList) : "[] (tidak ada — volume Google belum cukup untuk gap)"}

Tugas:
1. intents — map keyword → "transactional" | "informational" untuk SETIAP keyword di data mentah
2. gapReasons — array { keyword, reason } — alasan Bahasa Indonesia mengapa gap bagus (hanya untuk kandidat gap di atas)
3. namingSuggestions — 3 nama produk SEO-friendly
4. copyKeywords — { listingTitle, listingDescription, socialMedia } masing-masing 5-8 frasa
5. seasonalCalendar — 12 bulan Jan-Des dengan peak keywords
6. clusters — [{ name, keywords }] kelompokkan by intent/tema
7. aiSummary — 2-3 kalimat insight utama Bahasa Indonesia

Balas HANYA JSON valid:
{
  "intents": [{ "keyword": "string", "intent": "transactional"|"informational" }],
  "gapReasons": [{ "keyword": "string", "reason": "string" }],
  "namingSuggestions": ["string"],
  "copyKeywords": { "listingTitle": string[], "listingDescription": string[], "socialMedia": string[] },
  "seasonalCalendar": [{ "month": "Jan"|"Feb"|...|"Des", "keywords": string[] }],
  "clusters": [{ "name": "string", "keywords": string[] }],
  "aiSummary": "string"
}`;
}
