import "server-only";

import type { RawSocialMention } from "@/lib/research/social-listening/collect-mentions";

export function buildMentionAnalysisPrompt(input: {
  monitorName: string;
  keywords: string[];
  mentions: { id: string; text: string; platform: string }[];
}): string {
  const mentionLines = input.mentions
    .map((m) => `- [${m.id}] (${m.platform}) ${m.text.slice(0, 400)}`)
    .join("\n");

  return `Kamu adalah analis social listening untuk industri beauty & personal care Indonesia.

Monitor: "${input.monitorName}"
Keywords: ${input.keywords.join(", ")}

Klasifikasikan setiap mention berikut ke salah satu kelas:
COMPLAINT, PRAISE, QUESTION, WISHLIST, RECOMMENDATION, NEUTRAL

Untuk COMPLAINT/WISHLIST, ekstrak painPoint singkat (frasa masalah/keinginan).
Tandai isViral=true jika mention menunjukkan potensi viral (engagement tinggi atau topik trending).

Mentions:
${mentionLines}

Balas JSON dengan shape:
{
  "classifications": [
    {
      "id": "string (sama dengan id mention)",
      "classification": "COMPLAINT|PRAISE|QUESTION|WISHLIST|RECOMMENDATION|NEUTRAL",
      "painPoint": "string|null",
      "isViral": boolean
    }
  ],
  "aiSummary": "ringkasan 2-3 kalimat insight minggu ini"
}`;
}

export function chunkMentions<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

export function attachMentionIds(
  mentions: RawSocialMention[],
): { id: string; mention: RawSocialMention }[] {
  return mentions.map((m, i) => ({
    id: `m${i}`,
    mention: m,
  }));
}
