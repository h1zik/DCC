import "server-only";

import { generateResearchText } from "@/lib/research/gemini-client";
import {
  buildVisualTrendAnalytics,
  type VisualTrendCollectionAnalytics,
} from "@/lib/brand-research/visual-trend-analytics";

function formatCollectionBlock(c: VisualTrendCollectionAnalytics): string {
  const tags = c.topTags.map((t) => `${t.tag} (${t.count})`).join(", ") || "—";
  const palette = c.palette
    ? `primary ${c.palette.primary}, secondary ${c.palette.secondary}, accent ${c.palette.accent}`
    : "belum terdeteksi";
  return `- ${c.name}: ${c.assetCount} asset, tags dominan: ${tags}; palet: ${palette}`;
}

export async function generateVisualTrendBrief(
  userId: string,
  ownerBrandId: string | null | undefined,
  collectionId: string | null,
): Promise<string> {
  const collections = await buildVisualTrendAnalytics(userId, ownerBrandId);
  const selected =
    collectionId != null
      ? collections.filter((c) => c.id === collectionId)
      : collections;

  if (selected.length === 0) {
    throw new Error("Tidak ada koleksi Pinterest untuk dianalisis.");
  }

  const scope =
    collectionId != null
      ? `koleksi "${selected[0]!.name}"`
      : `${selected.length} koleksi Pinterest brand`;

  const prompt = `Anda adalah creative director kecantikan. Tulis ringkasan arah estetika visual (2–3 paragraf, bahasa Indonesia) untuk tim kreatif berdasarkan moodboard Pinterest berikut.

Scope: ${scope}

Data koleksi:
${selected.map(formatCollectionBlock).join("\n")}

Fokus pada: mood, palet warna, tekstur/material, komposisi foto, dan arahan styling produk. Hindari klaim data pasar — ini murni brief visual.`;

  return generateResearchText(prompt, { tier: "pro" });
}
