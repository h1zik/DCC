/**
 * Analisis pola listing marketplace + skor optimasi judul. Pure (tanpa server)
 * agar mudah di-test. Analyzer menyiapkan input dari hasil scraper-api.
 */

export type MarketplaceListing = {
  name: string;
  price: number | null;
  soldCount: number | null;
  rating: number | null;
  reviewCount: number | null;
  isOfficialShop: boolean;
};

export type TitleTerm = { term: string; count: number };

export type ListingStats = {
  count: number;
  avgTitleLength: number;
  medianPrice: number | null;
  priceMin: number | null;
  priceMax: number | null;
  avgRating: number | null;
  totalSold: number;
  officialShopRate: number;
};

export type TitleScore = {
  score: number;
  hasKeyword: boolean;
  lengthOk: boolean;
  coveredTerms: string[];
  missingTerms: string[];
};

/** Stopword umum (ID/EN) + token tak bermakna untuk pola judul. */
const STOPWORDS = new Set([
  "dan", "untuk", "yang", "dengan", "dari", "ini", "itu", "atau", "the",
  "for", "and", "with", "pcs", "isi", "free", "new", "by", "di", "ke",
  "pack", "set", "x", "ml", "gr", "gram",
]);

function tokenize(title: string): string[] {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    // Buang stopword, token pendek, dan token berawalan angka (varian ukuran: 30ml, 200gr).
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t) && !/^\d/.test(t));
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid];
}

/** Hitung statistik listing + istilah judul tersering. */
export function analyzeListings(listings: MarketplaceListing[]): {
  stats: ListingStats;
  topTitleTerms: TitleTerm[];
} {
  const count = listings.length;
  const prices = listings
    .map((l) => l.price)
    .filter((p): p is number => p != null && p > 0);
  const ratings = listings
    .map((l) => l.rating)
    .filter((r): r is number => r != null && r > 0);
  const totalSold = listings.reduce((s, l) => s + (l.soldCount ?? 0), 0);
  const officialCount = listings.filter((l) => l.isOfficialShop).length;
  const titleLengths = listings.map((l) => l.name.length);
  const avgTitleLength =
    count > 0 ? Math.round(titleLengths.reduce((s, v) => s + v, 0) / count) : 0;

  const freq = new Map<string, number>();
  for (const listing of listings) {
    const unique = new Set(tokenize(listing.name));
    for (const term of unique) freq.set(term, (freq.get(term) ?? 0) + 1);
  }
  const topTitleTerms: TitleTerm[] = [...freq.entries()]
    .map(([term, c]) => ({ term, count: c }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);

  return {
    stats: {
      count,
      avgTitleLength,
      medianPrice: median(prices),
      priceMin: prices.length ? Math.min(...prices) : null,
      priceMax: prices.length ? Math.max(...prices) : null,
      avgRating: ratings.length
        ? Math.round((ratings.reduce((s, v) => s + v, 0) / ratings.length) * 10) / 10
        : null,
      totalSold,
      officialShopRate: count > 0 ? Math.round((officialCount / count) * 100) / 100 : 0,
    },
    topTitleTerms,
  };
}

/** Skor judul produk sendiri vs pola listing teratas. */
export function scoreOwnTitle(
  ownTitle: string,
  keyword: string,
  topTerms: TitleTerm[],
  avgTitleLength: number,
): TitleScore {
  const titleTokens = new Set(tokenize(ownTitle));
  const lower = ownTitle.toLowerCase();
  const hasKeyword = keyword.trim().length > 0 && lower.includes(keyword.toLowerCase());

  const relevant = topTerms.slice(0, 10).map((t) => t.term);
  const covered = relevant.filter((t) => titleTokens.has(t));
  const missing = relevant.filter((t) => !titleTokens.has(t)).slice(0, 8);

  // Panjang ideal relatif terhadap rata-rata listing teratas (judul marketplace
  // cenderung panjang & kaya keyword), dengan batas absolut yang wajar.
  const len = ownTitle.trim().length;
  const minLen = Math.max(25, Math.round(avgTitleLength * 0.5));
  const lengthOk = len >= minLen && len <= 140;

  const coverageRatio = relevant.length > 0 ? covered.length / relevant.length : 0;
  const score = Math.round(
    (hasKeyword ? 30 : 0) + coverageRatio * 50 + (lengthOk ? 20 : 0),
  );

  return {
    score: Math.max(0, Math.min(100, score)),
    hasKeyword,
    lengthOk,
    coveredTerms: covered,
    missingTerms: missing,
  };
}
