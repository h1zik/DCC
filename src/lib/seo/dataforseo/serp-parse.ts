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
/** Semua posisi organik milik satu domain (untuk deteksi cannibalization). */
export function findAllDomainMatches(
  items: SerpResultItem[],
  domain: string,
): { position: number; url: string | null }[] {
  const target = normalizeDomain(domain);
  const out: { position: number; url: string | null }[] = [];
  for (const item of items) {
    if (item.type !== "organic") continue;
    const itemDomain = item.domain ? normalizeDomain(item.domain) : "";
    if (itemDomain !== target && !itemDomain.endsWith(`.${target}`)) continue;
    const position = item.rank_group ?? item.rank_absolute;
    if (position == null) continue;
    out.push({ position, url: item.url ?? null });
  }
  return out;
}

/** Posisi organik terbaik per domain: { domain: posisi | null }. */
export function findDomainRanks(
  items: SerpResultItem[],
  domains: string[],
): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  for (const domain of domains) {
    const key = normalizeDomain(domain);
    if (!key) continue;
    const match = findDomainRank(items, key);
    out[key] = match?.position ?? null;
  }
  return out;
}

export type UrlMatchTarget = {
  /** Host tanpa www. (null bila target hanya path). */
  host: string | null;
  /** Path tanpa trailing slash ("" = root). */
  path: string;
};

/**
 * Normalisasi URL/path untuk pencocokan targetUrl: lowercase, buang skema,
 * `www.`, query/hash, dan trailing slash. Input tanpa skema yang segmen
 * pertamanya tidak mengandung titik (mis. `produk/serum`) dianggap path.
 */
export function normalizeUrlTarget(input: string): UrlMatchTarget | null {
  let value = input.trim().toLowerCase();
  if (!value) return null;
  const hadScheme = /^https?:\/\//.test(value);
  value = value.replace(/^https?:\/\//, "");
  value = value.replace(/[?#].*$/, "");
  if (!value) return null;

  let host: string | null = null;
  let path: string;
  const slash = value.indexOf("/");
  const firstSegment = slash === -1 ? value : value.slice(0, slash);
  const looksLikeHost = hadScheme || firstSegment.includes(".");
  if (value.startsWith("/") || !looksLikeHost) {
    path = value.startsWith("/") ? value : `/${value}`;
  } else {
    host = firstSegment.replace(/^www\./, "") || null;
    path = slash === -1 ? "/" : value.slice(slash);
  }
  path = path.replace(/\/+$/, "");
  return { host, path };
}

/**
 * Cocokkan URL hasil SERP dengan target:
 * - target punya host → host+path harus sama persis;
 * - target hanya path → path sama persis, atau prefix diikuti "/".
 * Tidak ada pencocokan substring telanjang.
 */
export function urlMatchesTarget(
  resultUrl: string | null | undefined,
  target: UrlMatchTarget,
): boolean {
  if (!resultUrl) return false;
  const result = normalizeUrlTarget(resultUrl);
  if (!result) return false;
  if (target.host) {
    return result.host === target.host && result.path === target.path;
  }
  return (
    result.path === target.path || result.path.startsWith(`${target.path}/`)
  );
}

export type DomainRankMatch = {
  position: number;
  foundUrl: string | null;
  /** True bila posisi berasal dari featured snippet (tidak ada hasil organik yang cocok). */
  viaFeaturedSnippet: boolean;
};

/**
 * Cari posisi organik pertama yang cocok dengan `domain` (dan `targetUrl` bila
 * diberikan). Bila tidak ada hasil organik yang cocok tetapi ada featured
 * snippet milik domain tersebut, posisinya dipakai dengan flag
 * `viaFeaturedSnippet`. Null bila tidak masuk hasil.
 */
export function findDomainRank(
  items: SerpResultItem[],
  domain: string,
  targetUrl?: string | null,
): DomainRankMatch | null {
  const target = normalizeDomain(domain);
  if (!target) return null;
  const want = targetUrl ? normalizeUrlTarget(targetUrl) : null;

  const matches = (item: SerpResultItem): boolean => {
    const itemDomain = item.domain ? normalizeDomain(item.domain) : "";
    const domainMatch =
      itemDomain === target || itemDomain.endsWith(`.${target}`);
    if (!domainMatch) return false;
    if (want && !urlMatchesTarget(item.url, want)) return false;
    return true;
  };

  const pick = (
    type: "organic" | "featured_snippet",
  ): { position: number; foundUrl: string | null } | null => {
    for (const item of items) {
      if (item.type !== type || !matches(item)) continue;
      const position = item.rank_group ?? item.rank_absolute ?? null;
      if (position == null) continue;
      return { position, foundUrl: item.url ?? null };
    }
    return null;
  };

  const organic = pick("organic");
  if (organic) return { ...organic, viaFeaturedSnippet: false };
  const snippet = pick("featured_snippet");
  if (snippet) return { ...snippet, viaFeaturedSnippet: true };
  return null;
}
