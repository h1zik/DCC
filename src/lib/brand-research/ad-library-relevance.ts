export type AdRelevanceFields = {
  bodyText: string | null;
  linkTitle: string | null;
  pageName: string | null;
  linkUrl: string | null;
  rawData?: Record<string, unknown> | null;
};

export type AdRelevanceOptions = {
  /** Dari monitor.searchType — keyword_exact_phrase | keyword_unordered */
  searchType?: string | null;
};

/** Teks kreatif iklan yang dipakai untuk validasi keyword (bukan metadata scrape Meta). */
export function adCreativeSearchableText(ad: AdRelevanceFields): string {
  const parts = [ad.bodyText, ad.linkTitle, ad.pageName];
  return parts
    .filter((p): p is string => Boolean(p?.trim()))
    .join(" ")
    .toLowerCase();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Cocokkan frasa pada haystack dengan batas kata (bukan substring asal nempel),
 * supaya "parfum" tidak ikut lolos hanya karena ada kata "parfumxxx" dsb.
 * Batas kata pakai lookaround alfanumerik agar aman untuk teks non-ASCII.
 */
function phraseMatches(haystack: string, phrase: string): boolean {
  const normalized = phrase.replace(/\s+/g, " ").trim();
  if (!normalized) return false;
  const pattern = escapeRegExp(normalized).replace(/ /g, "\\s+");
  const re = new RegExp(`(?<![\\p{L}\\p{N}])${pattern}(?![\\p{L}\\p{N}])`, "iu");
  return re.test(haystack);
}

/** Untuk pencarian unordered: setiap kata di dalam term harus muncul (batas kata). */
function allWordsMatch(haystack: string, term: string): boolean {
  const words = term.split(/\s+/).map((w) => w.trim()).filter(Boolean);
  if (words.length === 0) return false;
  return words.every((word) => phraseMatches(haystack, word));
}

function termMatches(
  haystack: string,
  term: string,
  searchType?: string | null,
): boolean {
  if (searchType === "keyword_unordered") {
    return allWordsMatch(haystack, term);
  }
  // Default & keyword_exact_phrase: frasa harus muncul utuh (berurutan).
  return phraseMatches(haystack, term);
}

/**
 * True when ad copy mentions at least one monitor keyword.
 * Sengaja TIDAK memakai raw.searchTerm — field itu hanya keyword pencarian Meta,
 * bukan bukti iklan relevan (ini penyebab iklan tidak relevan/NSFW ikut lolos).
 * Pencocokan pakai batas kata / exact-phrase, bukan substring, supaya iklan spam
 * yang cuma menempelkan keyword di tengah kata lain tidak ikut lolos.
 */
export function adMatchesSearchTerms(
  ad: AdRelevanceFields,
  searchTerms: string[],
  options?: AdRelevanceOptions,
): boolean {
  const terms = searchTerms.map((t) => t.trim()).filter(Boolean);
  if (terms.length === 0) return true;

  const haystack = adCreativeSearchableText(ad);
  if (!haystack.trim()) return false;

  return terms.some((term) => termMatches(haystack, term, options?.searchType));
}

export function filterAdsBySearchRelevance<T extends AdRelevanceFields>(
  ads: T[],
  searchTerms: string[],
  options?: AdRelevanceOptions,
): T[] {
  const terms = searchTerms.map((t) => t.trim()).filter(Boolean);
  if (terms.length === 0) return ads;
  return ads.filter((ad) => adMatchesSearchTerms(ad, terms, options));
}
