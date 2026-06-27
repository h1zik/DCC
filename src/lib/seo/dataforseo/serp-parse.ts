/**
 * Helper parsing SERP murni (tanpa dependensi server) agar mudah di-test.
 * Dipakai oleh `serp.ts` yang menambahkan pemanggilan API + cache.
 */

export type SerpResultItem = {
  type?: string;
  rank_group?: number | null;
  rank_absolute?: number | null;
  domain?: string | null;
  url?: string | null;
  title?: string | null;
};

/** Normalisasi domain: lowercase, buang protokol, path, dan prefix www. */
export function normalizeDomain(input: string): string {
  let value = input.trim().toLowerCase();
  value = value.replace(/^https?:\/\//, "");
  value = value.replace(/\/.*$/, "");
  value = value.replace(/^www\./, "");
  return value;
}

/** Fitur SERP yang dianggap relevan untuk dilaporkan (selain organik biasa). */
const TRACKED_FEATURE_TYPES = new Set([
  "featured_snippet",
  "people_also_ask",
  "knowledge_graph",
  "local_pack",
  "map",
  "shopping",
  "video",
  "images",
  "top_stories",
  "related_searches",
  "ai_overview",
  "paid",
]);

export function extractSerpFeatures(items: SerpResultItem[]): string[] {
  const present = new Set<string>();
  for (const item of items) {
    const type = item.type?.trim();
    if (type && TRACKED_FEATURE_TYPES.has(type)) present.add(type);
  }
  return [...present];
}

/**
 * Cari posisi organik pertama yang cocok dengan `domain` (atau `targetUrl` bila
 * diberikan). Mengembalikan posisi (rank_group organik) + URL yang ditemukan,
 * atau null bila tidak masuk hasil.
 */
export function findDomainRank(
  items: SerpResultItem[],
  domain: string,
  targetUrl?: string | null,
): { position: number; foundUrl: string | null } | null {
  const target = normalizeDomain(domain);
  const wantPath = targetUrl?.trim().toLowerCase() || null;

  const organic = items.filter((i) => i.type === "organic");
  for (const item of organic) {
    const itemDomain = item.domain ? normalizeDomain(item.domain) : "";
    const domainMatch =
      itemDomain === target || itemDomain.endsWith(`.${target}`);
    if (!domainMatch) continue;

    if (wantPath) {
      const url = (item.url ?? "").toLowerCase();
      if (!url.includes(wantPath)) continue;
    }

    const position = item.rank_group ?? item.rank_absolute ?? null;
    if (position == null) continue;
    return { position, foundUrl: item.url ?? null };
  }
  return null;
}
