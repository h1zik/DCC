import {
  InfluencerPlatform,
  InfluencerTier,
  InfluencerVerdict,
} from "@prisma/client";

/**
 * Filter & urutan daftar influencer.
 *
 * Logikanya dipisah dari komponen supaya bisa diuji: pengelompokan vonis
 * ("layak dipakai", "perlu diperiksa") adalah keputusan produk, bukan sekadar
 * tampilan, dan gampang salah kalau hanya ditulis inline di JSX.
 */

/** Pilihan vonis gabungan yang bukan nilai enum. */
export const VERDICT_GROUP = {
  ALL: "all",
  /** Sangat bagus + Bagus — kandidat yang bisa langsung dipertimbangkan. */
  USABLE: "usable",
  /** Perlu dicek + Mencurigakan — antrean yang harus diperiksa manual. */
  FLAGGED: "flagged",
  UNAUDITED: "unaudited",
} as const;

export type InfluencerSortKey =
  | "recent"
  | "score"
  | "campaignEr"
  | "er"
  | "followers";

export type InfluencerFilterState = {
  search: string;
  platform: "all" | InfluencerPlatform;
  verdict: string;
  tier: "all" | InfluencerTier;
  sort: InfluencerSortKey;
};

export const DEFAULT_INFLUENCER_FILTERS: InfluencerFilterState = {
  search: "",
  platform: "all",
  verdict: VERDICT_GROUP.ALL,
  tier: "all",
  sort: "recent",
};

/** Bentuk minimal yang dibutuhkan — sengaja struktural agar cocok dengan baris UI. */
export type FilterableInfluencer = {
  handle: string;
  displayName: string | null;
  platform: InfluencerPlatform;
  tier: InfluencerTier | null;
  verdict: InfluencerVerdict | null;
  score: number | null;
  engagementRate: number | null;
  expectedCampaignEr: number | null;
  followers: number | null;
};

const USABLE_VERDICTS: InfluencerVerdict[] = [
  InfluencerVerdict.EXCELLENT,
  InfluencerVerdict.GOOD,
];

const FLAGGED_VERDICTS: InfluencerVerdict[] = [
  InfluencerVerdict.NEEDS_REVIEW,
  InfluencerVerdict.SUSPICIOUS,
];

function matchesVerdict(
  verdict: InfluencerVerdict | null,
  filter: string,
): boolean {
  switch (filter) {
    case VERDICT_GROUP.ALL:
      return true;
    case VERDICT_GROUP.USABLE:
      return verdict !== null && USABLE_VERDICTS.includes(verdict);
    case VERDICT_GROUP.FLAGGED:
      return verdict !== null && FLAGGED_VERDICTS.includes(verdict);
    case VERDICT_GROUP.UNAUDITED:
      return verdict === null;
    default:
      return verdict === filter;
  }
}

function matchesSearch(row: FilterableInfluencer, search: string): boolean {
  const q = search.trim().toLowerCase();
  if (!q) return true;
  // "@" diabaikan supaya menempel link atau mengetik handle sama-sama jalan.
  const needle = q.replace(/^@/, "");
  return (
    row.handle.toLowerCase().includes(needle) ||
    (row.displayName ?? "").toLowerCase().includes(needle)
  );
}

export function matchesInfluencerFilter(
  row: FilterableInfluencer,
  filters: InfluencerFilterState,
): boolean {
  if (filters.platform !== "all" && row.platform !== filters.platform) {
    return false;
  }
  if (filters.tier !== "all" && row.tier !== filters.tier) return false;
  if (!matchesVerdict(row.verdict, filters.verdict)) return false;
  return matchesSearch(row, filters.search);
}

/** Nilai kosong selalu di bawah, apa pun arah urutannya. */
function byNumberDesc(a: number | null, b: number | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return b - a;
}

export function sortInfluencers<T extends FilterableInfluencer>(
  rows: T[],
  sort: InfluencerSortKey,
): T[] {
  // "recent" mempertahankan urutan dari server (updatedAt menurun) — termasuk
  // profil yang belum pernah diaudit, yang akan tenggelam kalau diurutkan
  // memakai tanggal audit.
  if (sort === "recent") return rows;

  const copy = [...rows];
  switch (sort) {
    case "score":
      return copy.sort((a, b) => byNumberDesc(a.score, b.score));
    case "campaignEr":
      return copy.sort((a, b) =>
        byNumberDesc(a.expectedCampaignEr, b.expectedCampaignEr),
      );
    case "er":
      return copy.sort((a, b) =>
        byNumberDesc(a.engagementRate, b.engagementRate),
      );
    case "followers":
      return copy.sort((a, b) => byNumberDesc(a.followers, b.followers));
    default:
      return copy;
  }
}

export function applyInfluencerFilters<T extends FilterableInfluencer>(
  rows: T[],
  filters: InfluencerFilterState,
): T[] {
  return sortInfluencers(
    rows.filter((row) => matchesInfluencerFilter(row, filters)),
    filters.sort,
  );
}

/** Dipakai UI untuk memunculkan tombol reset hanya saat ada yang aktif. */
export function isInfluencerFilterActive(
  filters: InfluencerFilterState,
): boolean {
  return (
    filters.search.trim() !== "" ||
    filters.platform !== "all" ||
    filters.verdict !== VERDICT_GROUP.ALL ||
    filters.tier !== "all"
  );
}

/** Jumlah filter aktif — sort tidak dihitung karena selalu punya nilai. */
export function countActiveInfluencerFilters(
  filters: InfluencerFilterState,
): number {
  let n = 0;
  if (filters.search.trim() !== "") n += 1;
  if (filters.platform !== "all") n += 1;
  if (filters.verdict !== VERDICT_GROUP.ALL) n += 1;
  if (filters.tier !== "all") n += 1;
  return n;
}
