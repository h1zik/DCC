/**
 * Analisis pola listing marketplace + skor judul (heuristik). Pure (tanpa
 * server) agar mudah di-test. Analyzer menyiapkan input dari hasil scraper-api.
 *
 * Skor judul BUKAN metrik ranking marketplace — ia heuristik gabungan dari:
 * keyword ada di judul (token-based), overlap dengan istilah teratas listing
 * pesaing (di luar token keyword), dan panjang judul.
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
  /**
   * Akumulasi `soldCount` listing teratas. Semantiknya tergantung marketplace:
   * Shopee = terjual/bulan, Tokopedia = total terjual (lifetime). UI melabeli
   * per marketplace.
   */
  totalSold: number;
  officialShopRate: number;
};

export type TitleScore = {
  /** 0–100, heuristik (lihat komentar modul). */
  score: number;
  hasKeyword: boolean;
  lengthOk: boolean;
  coveredTerms: string[];
  missingTerms: string[];
};

/** Bobot komponen skor judul (total 100). */
export const TITLE_SCORE_WEIGHTS = {
  keyword: 30,
  coverage: 50,
  length: 20,
} as const;

/**
 * Stopword umum (ID/EN) + filler judul marketplace Indonesia yang hampir
 * selalu muncul dan tidak membedakan produk (ori, murah, promo, cod, ...).
 */
const STOPWORDS = new Set([
  // Kata fungsi ID/EN
  "dan", "untuk", "yang", "dengan", "dari", "ini", "itu", "atau", "the",
  "for", "and", "with", "by", "di", "ke", "bisa", "isi", "per",
  // Unit & kemasan
  "pcs", "pack", "set", "x", "ml", "gr", "gram", "kg",
  // Filler marketplace
  "original", "ori", "murah", "termurah", "promo", "cod", "ready", "stok",
  "stock", "bpom", "gratis", "ongkir", "free", "best", "seller", "terlaris",
  "diskon", "sale", "flash", "garansi", "resmi", "official", "new", "baru",
]);

/** Token mentah: lowercase, non-alfanumerik jadi spasi, buang token < `minLen`. */
function rawTokens(text: string, minLen: number): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= minLen);
}

/** Token judul untuk pola istilah: tanpa stopword, token pendek, dan varian ukuran (30ml). */
function tokenize(title: string): string[] {
  return rawTokens(title, 3).filter((t) => !STOPWORDS.has(t) && !/^\d/.test(t));
}

/** Token keyword: lowercase, pisah spasi, buang token < 2 karakter. Stopword TIDAK dibuang. */
export function keywordTokens(keyword: string): string[] {
  return [...new Set(rawTokens(keyword, 2))];
}

/** True bila semua token keyword ada di token judul (urutan bebas). */
export function titleHasKeyword(title: string, keyword: string): boolean {
  const kw = keywordTokens(keyword);
  if (kw.length === 0) return false;
  const titleSet = new Set(rawTokens(title, 2));
  return kw.every((t) => titleSet.has(t));
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

/**
 * Skor judul produk sendiri (heuristik) vs pola listing teratas.
 * - keyword (30): semua token keyword ada di judul;
 * - coverage (50): porsi 10 istilah teratas pesaing — DI LUAR token keyword,
 *   supaya keyword tidak dihitung dua kali — yang ada di judul; bila tidak ada
 *   istilah di luar keyword, komponen ini dianggap penuh (tidak ada yang kurang);
 * - panjang (20): ≥ max(25, 50% rata-rata pesaing) dan ≤ 140 karakter.
 */
export function scoreOwnTitle(
  ownTitle: string,
  keyword: string,
  topTerms: TitleTerm[],
  avgTitleLength: number,
): TitleScore {
  const titleTokens = new Set(tokenize(ownTitle));
  const hasKeyword = titleHasKeyword(ownTitle, keyword);

  const kwSet = new Set(keywordTokens(keyword));
  const relevant = topTerms
    .map((t) => t.term)
    .filter((t) => !kwSet.has(t))
    .slice(0, 10);
  const covered = relevant.filter((t) => titleTokens.has(t));
  const missing = relevant.filter((t) => !titleTokens.has(t)).slice(0, 8);

  // Panjang ideal relatif terhadap rata-rata listing teratas (judul marketplace
  // cenderung panjang & kaya keyword), dengan batas absolut yang wajar.
  const len = ownTitle.trim().length;
  const minLen = Math.max(25, Math.round(avgTitleLength * 0.5));
  const lengthOk = len >= minLen && len <= 140;

  const coverageRatio = relevant.length > 0 ? covered.length / relevant.length : 1;
  const score = Math.round(
    (hasKeyword ? TITLE_SCORE_WEIGHTS.keyword : 0) +
      coverageRatio * TITLE_SCORE_WEIGHTS.coverage +
      (lengthOk ? TITLE_SCORE_WEIGHTS.length : 0),
  );

  return {
    score: Math.max(0, Math.min(100, score)),
    hasKeyword,
    lengthOk,
    coveredTerms: covered,
    missingTerms: missing,
  };
}
