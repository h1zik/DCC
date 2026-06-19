import "server-only";

export function buildCommentAnalysisPrompt(input: {
  monitorName: string;
  keywords: string[];
  comments: { id: string; text: string; platform: string }[];
}): string {
  const lines = input.comments
    .map((c) => `- [${c.id}] (${c.platform}) ${c.text.slice(0, 350)}`)
    .join("\n");

  return `Kamu adalah analis social listening untuk industri beauty & personal care Indonesia.

Monitor: "${input.monitorName}"
Keywords: ${input.keywords.join(", ")}

Analisis KOMENTAR netizen (bukan caption post). Komentar sering lebih jujur, spesifik, dan actionable.

Klasifikasikan setiap komentar:
COMPLAINT, PRAISE, QUESTION, WISHLIST, RECOMMENDATION, NEUTRAL

Untuk COMPLAINT/WISHLIST, ekstrak painPoint singkat (masalah produk, texture, harga, efek, availability).
Perhatikan sinyal pembelian ("mau beli", "link dong"), perbandingan brand, dan keluhan efek samping.

Komentar:
${lines}

Balas JSON:
{
  "classifications": [
    {
      "id": "string",
      "classification": "COMPLAINT|PRAISE|QUESTION|WISHLIST|RECOMMENDATION|NEUTRAL",
      "painPoint": "string|null"
    }
  ],
  "commentAiSummary": "ringkasan 2-3 kalimat insight dari komentar — apa yang netizen benar-benar rasakan vs caption"
}`;
}

export { chunkMentions, attachMentionIds } from "@/lib/research/social-listening/prompts/mention-analysis";
