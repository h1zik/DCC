import { InfluencerPlatform, InfluencerTier } from "@prisma/client";
import { isCreatorCategory } from "@/lib/brand-research/influencer/discovery/categories";

/**
 * Filter, urutan, dan paginasi daftar kreator — dibaca dari URL.
 *
 * Berbeda dari `list-filter.ts` milik Influencer Audit yang menyaring di sisi
 * klien: di sana datanya puluhan, di sini bisa puluhan ribu. Menyaring di klien
 * berarti mengirim seluruh database ke browser setiap kali halaman dibuka, jadi
 * seluruh penyaringan di sini diterjemahkan jadi query Prisma.
 *
 * Bagian ini sengaja murni supaya bisa diuji — nilai dari URL tidak boleh
 * dipercaya, dan enum asing harus jatuh ke default alih-alih menghasilkan
 * daftar kosong yang membingungkan.
 */

export type RadarSortKey =
  | "relevance"
  | "followers"
  | "engagement"
  | "newest";

export type RadarFilterState = {
  search: string;
  platform: "all" | InfluencerPlatform;
  category: "all" | "unclassified" | string;
  tier: "all" | InfluencerTier;
  /** Hanya kreator yang sudah punya angka. */
  measuredOnly: boolean;
  sort: RadarSortKey;
  page: number;
};

export const RADAR_PAGE_SIZE = 25;

export const DEFAULT_RADAR_FILTERS: RadarFilterState = {
  search: "",
  platform: "all",
  category: "all",
  tier: "all",
  measuredOnly: false,
  sort: "relevance",
  page: 1,
};

export const RADAR_PARAMS = {
  search: "q",
  platform: "platform",
  category: "cat",
  tier: "tier",
  measuredOnly: "measured",
  sort: "sort",
  page: "page",
} as const;

const SORT_KEYS: RadarSortKey[] = [
  "relevance",
  "followers",
  "engagement",
  "newest",
];

export const RADAR_SORT_LABEL: Record<RadarSortKey, string> = {
  relevance: "Paling relevan",
  followers: "Follower terbanyak",
  engagement: "Engagement tertinggi",
  newest: "Terbaru ditemukan",
};

const MAX_SEARCH_LENGTH = 100;
/** Pagar supaya `?page=999999` tidak berubah jadi OFFSET raksasa. */
const MAX_PAGE = 400;

type ParamSource = { get(name: string): string | null } | null | undefined;

function pick<T extends string>(
  raw: string | null,
  allowed: readonly T[],
  fallback: T,
): T {
  return raw !== null && (allowed as readonly string[]).includes(raw)
    ? (raw as T)
    : fallback;
}

function parsePage(raw: string | null): number {
  const n = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, MAX_PAGE);
}

export function parseRadarFilters(params: ParamSource): RadarFilterState {
  if (!params) return DEFAULT_RADAR_FILTERS;

  const rawCategory = params.get(RADAR_PARAMS.category);
  const category =
    rawCategory === "unclassified" || isCreatorCategory(rawCategory)
      ? rawCategory
      : "all";

  return {
    search: (params.get(RADAR_PARAMS.search) ?? "").slice(0, MAX_SEARCH_LENGTH),
    platform: pick(
      params.get(RADAR_PARAMS.platform),
      ["all", ...Object.values(InfluencerPlatform)] as const,
      "all",
    ),
    category,
    tier: pick(
      params.get(RADAR_PARAMS.tier),
      ["all", ...Object.values(InfluencerTier)] as const,
      "all",
    ),
    measuredOnly: params.get(RADAR_PARAMS.measuredOnly) === "1",
    sort: pick(params.get(RADAR_PARAMS.sort), SORT_KEYS, "relevance"),
    page: parsePage(params.get(RADAR_PARAMS.page)),
  };
}

/** Query string untuk keadaan filter tertentu; nilai default dibuang. */
export function radarFilterQuery(filters: RadarFilterState): string {
  const params = new URLSearchParams();
  const search = filters.search.trim().slice(0, MAX_SEARCH_LENGTH);

  const entries: [string, string, string][] = [
    [RADAR_PARAMS.search, search, ""],
    [RADAR_PARAMS.platform, filters.platform, "all"],
    [RADAR_PARAMS.category, filters.category, "all"],
    [RADAR_PARAMS.tier, filters.tier, "all"],
    [RADAR_PARAMS.measuredOnly, filters.measuredOnly ? "1" : "0", "0"],
    [RADAR_PARAMS.sort, filters.sort, "relevance"],
    [RADAR_PARAMS.page, String(filters.page), "1"],
  ];

  for (const [key, value, fallback] of entries) {
    if (value !== fallback) params.set(key, value);
  }

  return params.toString();
}

export function isRadarFilterActive(filters: RadarFilterState): boolean {
  return (
    filters.search.trim() !== "" ||
    filters.platform !== "all" ||
    filters.category !== "all" ||
    filters.tier !== "all" ||
    filters.measuredOnly
  );
}

export function countActiveRadarFilters(filters: RadarFilterState): number {
  let n = 0;
  if (filters.search.trim() !== "") n += 1;
  if (filters.platform !== "all") n += 1;
  if (filters.category !== "all") n += 1;
  if (filters.tier !== "all") n += 1;
  if (filters.measuredOnly) n += 1;
  return n;
}
