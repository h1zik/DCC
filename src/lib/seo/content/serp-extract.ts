import type { SerpResultItem } from "@/lib/seo/dataforseo/serp-parse";

/**
 * Ekstraksi data SERP untuk grounding brief konten. Pure (tanpa server) agar
 * mudah di-test. Payload mentah `fetchSerpLive` sudah memuat item PAA/related
 * searches — tipe `SerpResultItem` sengaja sempit untuk rank tracker, jadi di
 * sini kita pakai tipe lokal yang lebih lebar TANPA mengubah `serp-parse.ts`.
 */

export type SerpRawItem = SerpResultItem & {
  /** Sub-item (dipakai people_also_ask & related_searches). */
  items?: unknown;
};

export type SerpOrganicResult = {
  rank: number;
  title: string;
  url: string;
  domain: string;
};

/** Ambil top-N hasil organik yang punya title + url. */
export function extractTopOrganic(
  items: SerpRawItem[],
  n = 10,
): SerpOrganicResult[] {
  const out: SerpOrganicResult[] = [];
  for (const item of items) {
    if (item.type !== "organic") continue;
    const rank = item.rank_group ?? item.rank_absolute;
    const title = item.title?.trim();
    const url = item.url?.trim();
    if (rank == null || !title || !url) continue;
    out.push({
      rank,
      title,
      url,
      domain: item.domain?.trim().toLowerCase() ?? "",
    });
    if (out.length >= n) break;
  }
  return out;
}

type PaaElement = {
  type?: string;
  title?: string | null;
  seed_question?: string | null;
};

/** Ambil pertanyaan People Also Ask (unik, urutan SERP). */
export function extractPaaQuestions(items: SerpRawItem[]): string[] {
  const questions: string[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    if (item.type !== "people_also_ask" || !Array.isArray(item.items)) continue;
    for (const sub of item.items as PaaElement[]) {
      if (!sub || typeof sub !== "object") continue;
      const q = (sub.seed_question ?? sub.title ?? "").toString().trim();
      const key = q.toLowerCase();
      if (!q || seen.has(key)) continue;
      seen.add(key);
      questions.push(q);
    }
  }
  return questions;
}

/** Ambil related searches (unik). */
export function extractRelatedSearches(items: SerpRawItem[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    if (item.type !== "related_searches" || !Array.isArray(item.items)) continue;
    for (const sub of item.items as unknown[]) {
      const q = typeof sub === "string" ? sub.trim() : "";
      const key = q.toLowerCase();
      if (!q || seen.has(key)) continue;
      seen.add(key);
      out.push(q);
    }
  }
  return out;
}
