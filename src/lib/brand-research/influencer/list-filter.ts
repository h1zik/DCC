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

/* ─── Bolak-balik ke URL ────────────────────────────────────────────────
 *
 * Filter disimpan di query supaya bertahan saat pengguna membuka satu
 * influencer lalu kembali — dan supaya tampilan yang sudah disaring bisa
 * dikirim ke rekan lewat link. Nilai dari URL tidak boleh dipercaya begitu
 * saja: enum yang tidak dikenal harus jatuh ke default, bukan menghasilkan
 * daftar kosong yang membingungkan.
 */

/** Nama parameter di URL. `q` dipakai untuk pencarian karena lebih pendek. */
export const INFLUENCER_FILTER_PARAMS = {
  search: "q",
  platform: "platform",
  verdict: "verdict",
  tier: "tier",
  sort: "sort",
} as const;

const SORT_KEYS: InfluencerSortKey[] = [
  "recent",
  "score",
  "campaignEr",
  "er",
  "followers",
];

const VERDICT_VALUES: string[] = [
  ...Object.values(VERDICT_GROUP),
  ...Object.values(InfluencerVerdict),
];

/** Batas panjang pencarian — URL tidak perlu menampung novel. */
const MAX_SEARCH_LENGTH = 100;

type ParamSource = {
  get(name: string): string | null;
} | null | undefined;

function pick<T extends string>(
  raw: string | null,
  allowed: readonly T[],
  fallback: T,
): T {
  return raw !== null && (allowed as readonly string[]).includes(raw)
    ? (raw as T)
    : fallback;
}

export function parseInfluencerFilters(
  params: ParamSource,
): InfluencerFilterState {
  if (!params) return DEFAULT_INFLUENCER_FILTERS;

  return {
    search: (params.get(INFLUENCER_FILTER_PARAMS.search) ?? "").slice(
      0,
      MAX_SEARCH_LENGTH,
    ),
    platform: pick(
      params.get(INFLUENCER_FILTER_PARAMS.platform),
      ["all", ...Object.values(InfluencerPlatform)] as const,
      "all",
    ),
    verdict: pick(
      params.get(INFLUENCER_FILTER_PARAMS.verdict),
      VERDICT_VALUES,
      VERDICT_GROUP.ALL,
    ),
    tier: pick(
      params.get(INFLUENCER_FILTER_PARAMS.tier),
      ["all", ...Object.values(InfluencerTier)] as const,
      "all",
    ),
    sort: pick(params.get(INFLUENCER_FILTER_PARAMS.sort), SORT_KEYS, "recent"),
  };
}

/** Apakah URL memang membawa filter — dipakai memutuskan perlu-tidaknya pulihkan. */
export function hasInfluencerFilterParams(params: ParamSource): boolean {
  if (!params) return false;
  return Object.values(INFLUENCER_FILTER_PARAMS).some(
    (key) => params.get(key) !== null,
  );
}

/**
 * Query string untuk keadaan filter tertentu. Parameter lain di `base`
 * (mis. `brandId` dari sub-nav Brand Hub) dipertahankan, dan nilai default
 * dibuang supaya URL tetap bersih saat tidak ada filter yang aktif.
 */
export function influencerFilterQuery(
  filters: InfluencerFilterState,
  base?: URLSearchParams,
): string {
  const params = new URLSearchParams(base?.toString() ?? "");
  const search = filters.search.trim().slice(0, MAX_SEARCH_LENGTH);

  const entries: [string, string, string][] = [
    [INFLUENCER_FILTER_PARAMS.search, search, ""],
    [INFLUENCER_FILTER_PARAMS.platform, filters.platform, "all"],
    [INFLUENCER_FILTER_PARAMS.verdict, filters.verdict, VERDICT_GROUP.ALL],
    [INFLUENCER_FILTER_PARAMS.tier, filters.tier, "all"],
    [INFLUENCER_FILTER_PARAMS.sort, filters.sort, "recent"],
  ];

  for (const [key, value, fallback] of entries) {
    if (value === fallback) params.delete(key);
    else params.set(key, value);
  }

  return params.toString();
}

/** Semua filter DAN urutan masih di posisi awal. */
export function isInfluencerFilterPristine(
  filters: InfluencerFilterState,
): boolean {
  return (
    !isInfluencerFilterActive(filters) &&
    filters.sort === DEFAULT_INFLUENCER_FILTERS.sort
  );
}

/**
 * Parameter tempat halaman detail menyimpan filter daftar asalnya, supaya
 * tombol "kembali" mengembalikan pengguna ke tampilan yang sama persis —
 * bukan ke daftar penuh yang harus disaring ulang.
 */
export const INFLUENCER_RETURN_PARAM = "from";

/**
 * Bangun href kembali ke daftar dari nilai `from` yang dibawa URL detail.
 *
 * Nilainya berasal dari URL sehingga tidak boleh dipercaya: isinya dicuci
 * lewat parser filter yang sama, jadi kunci asing dibuang dan enum yang tidak
 * dikenal jatuh ke default. Path-nya tetap dari argumen — tidak ada jalan
 * untuk mengarahkan tombol ini ke alamat lain.
 */
export function influencerListHref(
  listPath: string,
  options: { brandId?: string | null; from?: string | null } = {},
): string {
  const params = new URLSearchParams(
    influencerFilterQuery(parseInfluencerFilters(readReturnParams(options.from))),
  );
  if (options.brandId) params.set("brandId", options.brandId);

  const query = params.toString();
  return query ? `${listPath}?${query}` : listPath;
}

function readReturnParams(from: string | null | undefined): URLSearchParams | null {
  if (!from) return null;
  try {
    return new URLSearchParams(from);
  } catch {
    return null;
  }
}
