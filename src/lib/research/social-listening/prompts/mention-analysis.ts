import "server-only";

import type { RawSocialMention } from "@/lib/research/social-listening/collect-mentions";
import { buildActionPlanInstruction } from "@/lib/research/prescriptive/prompt";

export function buildSocialActionPlanPrompt(input: {
  monitorName: string;
  painPoints: { theme: string; count: number }[];
  wishlist: { theme: string; count: number }[];
  categoryBreakdown: { classification: string; count: number; pct: number }[];
}): string {
  return `Kamu adalah strateg brand beauty & personal care Indonesia.
Berdasarkan social listening monitor "${input.monitorName}", buat rencana aksi konkret.

Top pain points (keluhan netizen): ${
    input.painPoints.length > 0
      ? input.painPoints
          .map((p) => `${p.theme} (${p.count}x)`)
          .join("; ")
      : "tidak ada"
  }
Top wishlist (keinginan netizen): ${
    input.wishlist.length > 0
      ? input.wishlist.map((w) => `${w.theme} (${w.count}x)`).join("; ")
      : "tidak ada"
  }
Distribusi sentimen: ${input.categoryBreakdown
    .map((c) => `${c.classification} ${c.pct}%`)
    .join(", ")}

Pedoman: pain point → perbaikan produk/komunikasi (RND/BRAND); wishlist → peluang produk baru (RND/MARKETING); sentimen negatif tinggi → manajemen reputasi (BRAND).

${buildActionPlanInstruction(["BRAND", "MARKETING", "RND"])}

Balas HANYA JSON valid:
{ "actionPlan": { "headline": "string", "recommendations": [ /* skema di atas */ ] } }`;
}

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
