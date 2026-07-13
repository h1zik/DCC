import "server-only";

import {
  dataForSeoLive,
  getDataForSeoLanguageCode,
  getDataForSeoLocationCode,
} from "@/lib/seo/dataforseo/client";
import { withDataForSeoCache } from "@/lib/seo/dataforseo/cache";

/**
 * Wrapper DataForSEO Labs untuk fitur Domain Overview & Keyword Gap.
 * Semua endpoint live-only (Labs tidak punya metode queue); hasil di-cache.
 */

export type LabsDomainOptions = {
  locationCode?: number;
  languageCode?: string;
  limit?: number;
};

function baseParams(opts: LabsDomainOptions) {
  return {
    location_code: opts.locationCode ?? getDataForSeoLocationCode(),
    language_code: String(opts.languageCode ?? getDataForSeoLanguageCode()),
  };
}

/* ------------------------------ rank overview ------------------------------ */

export type DomainRankOverview = {
  organicTraffic: number | null;
  organicKeywords: number | null;
  organicCost: number | null;
  paidKeywords: number | null;
  posBuckets: {
    pos1: number;
    pos2_3: number;
    pos4_10: number;
    pos11_20: number;
    pos21_100: number;
  } | null;
};

type DfsRankOverviewItem = {
  metrics?: {
    organic?: {
      etv?: number | null;
      count?: number | null;
      estimated_paid_traffic_cost?: number | null;
      pos_1?: number | null;
      pos_2_3?: number | null;
      pos_4_10?: number | null;
      pos_11_20?: number | null;
      pos_21_30?: number | null;
      pos_31_40?: number | null;
      pos_41_50?: number | null;
      pos_51_60?: number | null;
      pos_61_70?: number | null;
      pos_71_80?: number | null;
      pos_81_90?: number | null;
      pos_91_100?: number | null;
    } | null;
    paid?: { count?: number | null } | null;
  } | null;
};

type DfsItemsResult<T> = { items?: T[] | null };

const sumOrNull = (...vals: (number | null | undefined)[]): number => {
  let total = 0;
  for (const v of vals) total += v ?? 0;
  return total;
};

export async function fetchDomainRankOverview(
  target: string,
  opts: LabsDomainOptions = {},
): Promise<DomainRankOverview | null> {
  const endpoint = "dataforseo_labs/google/domain_rank_overview/live";
  const payload = { target, ...baseParams(opts) };

  const items = await withDataForSeoCache(endpoint, payload, async () => {
    const result = await dataForSeoLive<DfsItemsResult<DfsRankOverviewItem>>(
      endpoint,
      payload,
    );
    return result[0]?.items ?? [];
  });

  const organic = items[0]?.metrics?.organic;
  if (!organic) return null;

  return {
    organicTraffic: organic.etv != null ? Math.round(organic.etv) : null,
    organicKeywords: organic.count ?? null,
    organicCost:
      organic.estimated_paid_traffic_cost != null
        ? Math.round(organic.estimated_paid_traffic_cost)
        : null,
    paidKeywords: items[0]?.metrics?.paid?.count ?? null,
    posBuckets: {
      pos1: organic.pos_1 ?? 0,
      pos2_3: organic.pos_2_3 ?? 0,
      pos4_10: organic.pos_4_10 ?? 0,
      pos11_20: organic.pos_11_20 ?? 0,
      pos21_100: sumOrNull(
        organic.pos_21_30,
        organic.pos_31_40,
        organic.pos_41_50,
        organic.pos_51_60,
        organic.pos_61_70,
        organic.pos_71_80,
        organic.pos_81_90,
        organic.pos_91_100,
      ),
    },
  };
}

/* ------------------------------ ranked keywords ----------------------------- */

export type RankedKeyword = {
  keyword: string;
  position: number | null;
  searchVolume: number | null;
  difficulty: number | null;
  etv: number | null;
  url: string | null;
};

type DfsRankedItem = {
  keyword_data?: {
    keyword?: string | null;
    keyword_info?: { search_volume?: number | null } | null;
    keyword_properties?: { keyword_difficulty?: number | null } | null;
  } | null;
  ranked_serp_element?: {
    serp_item?: {
      rank_group?: number | null;
      etv?: number | null;
      url?: string | null;
    } | null;
  } | null;
};

export async function fetchRankedKeywords(
  target: string,
  opts: LabsDomainOptions = {},
): Promise<RankedKeyword[]> {
  const endpoint = "dataforseo_labs/google/ranked_keywords/live";
  const payload = {
    target,
    ...baseParams(opts),
    limit: Math.min(500, Math.max(10, opts.limit ?? 300)),
    order_by: ["ranked_serp_element.serp_item.etv,desc"],
  };

  const items = await withDataForSeoCache(endpoint, payload, async () => {
    const result = await dataForSeoLive<DfsItemsResult<DfsRankedItem>>(
      endpoint,
      payload,
    );
    return result[0]?.items ?? [];
  });

  return (items ?? [])
    .map((item): RankedKeyword | null => {
      const kw = item.keyword_data?.keyword?.trim();
      if (!kw) return null;
      const serp = item.ranked_serp_element?.serp_item;
      return {
        keyword: kw,
        position: serp?.rank_group ?? null,
        searchVolume: item.keyword_data?.keyword_info?.search_volume ?? null,
        difficulty:
          item.keyword_data?.keyword_properties?.keyword_difficulty != null
            ? Math.round(item.keyword_data.keyword_properties.keyword_difficulty)
            : null,
        etv: serp?.etv != null ? Math.round(serp.etv) : null,
        url: serp?.url ?? null,
      };
    })
    .filter((k): k is RankedKeyword => k != null);
}

/* ---------------------------- competitors domain ---------------------------- */

export type CompetitorDomain = {
  domain: string;
  avgPosition: number | null;
  intersections: number | null;
  etv: number | null;
};

type DfsCompetitorItem = {
  domain?: string | null;
  avg_position?: number | null;
  intersections?: number | null;
  full_domain_metrics?: { organic?: { etv?: number | null } | null } | null;
};

export async function fetchCompetitorsDomain(
  target: string,
  opts: LabsDomainOptions = {},
): Promise<CompetitorDomain[]> {
  const endpoint = "dataforseo_labs/google/competitors_domain/live";
  const payload = {
    target,
    ...baseParams(opts),
    limit: Math.min(30, Math.max(5, opts.limit ?? 10)),
    exclude_top_domains: true,
  };

  const items = await withDataForSeoCache(endpoint, payload, async () => {
    const result = await dataForSeoLive<DfsItemsResult<DfsCompetitorItem>>(
      endpoint,
      payload,
    );
    return result[0]?.items ?? [];
  });

  return (items ?? [])
    .map((item): CompetitorDomain | null => {
      const domain = item.domain?.trim().toLowerCase();
      if (!domain) return null;
      return {
        domain,
        avgPosition:
          item.avg_position != null ? Math.round(item.avg_position * 10) / 10 : null,
        intersections: item.intersections ?? null,
        etv:
          item.full_domain_metrics?.organic?.etv != null
            ? Math.round(item.full_domain_metrics.organic.etv)
            : null,
      };
    })
    .filter((c): c is CompetitorDomain => c != null);
}

/* ---------------------------- domain intersection --------------------------- */

export type IntersectionRow = {
  keyword: string;
  searchVolume: number | null;
  difficulty: number | null;
  targetPosition: number | null;
  competitorPosition: number | null;
};

type DfsIntersectionItem = {
  keyword_data?: {
    keyword?: string | null;
    keyword_info?: { search_volume?: number | null } | null;
    keyword_properties?: { keyword_difficulty?: number | null } | null;
  } | null;
  first_domain_serp_element?: { serp_item?: { rank_group?: number | null } | null } | null;
  second_domain_serp_element?: { serp_item?: { rank_group?: number | null } | null } | null;
};

/**
 * Keyword yang di-ranking target dan/atau satu kompetitor
 * (`intersections: false` agar keyword eksklusif kompetitor ikut → bucket
 * missing/untapped bisa dihitung).
 */
export async function fetchDomainIntersection(
  target: string,
  competitor: string,
  opts: LabsDomainOptions = {},
): Promise<IntersectionRow[]> {
  const endpoint = "dataforseo_labs/google/domain_intersection/live";
  const payload = {
    target1: target,
    target2: competitor,
    ...baseParams(opts),
    intersections: false,
    limit: Math.min(500, Math.max(10, opts.limit ?? 300)),
    order_by: ["keyword_data.keyword_info.search_volume,desc"],
  };

  const items = await withDataForSeoCache(endpoint, payload, async () => {
    const result = await dataForSeoLive<DfsItemsResult<DfsIntersectionItem>>(
      endpoint,
      payload,
    );
    return result[0]?.items ?? [];
  });

  return (items ?? [])
    .map((item): IntersectionRow | null => {
      const kw = item.keyword_data?.keyword?.trim();
      if (!kw) return null;
      return {
        keyword: kw,
        searchVolume: item.keyword_data?.keyword_info?.search_volume ?? null,
        difficulty:
          item.keyword_data?.keyword_properties?.keyword_difficulty != null
            ? Math.round(item.keyword_data.keyword_properties.keyword_difficulty)
            : null,
        targetPosition:
          item.first_domain_serp_element?.serp_item?.rank_group ?? null,
        competitorPosition:
          item.second_domain_serp_element?.serp_item?.rank_group ?? null,
      };
    })
    .filter((r): r is IntersectionRow => r != null);
}

/* --------------------------- historical rank overview ------------------------ */

export type DomainHistoryPoint = {
  /** "YYYY-MM". */
  month: string;
  organicTraffic: number | null;
  organicKeywords: number | null;
};

type DfsHistoricalItem = {
  year?: number | null;
  month?: number | null;
  metrics?: {
    organic?: { etv?: number | null; count?: number | null } | null;
  } | null;
};

/**
 * Tren bulanan trafik & jumlah keyword organik domain —
 * `dataforseo_labs/google/historical_rank_overview/live` (cache 7 hari).
 */
export async function fetchHistoricalRankOverview(
  target: string,
  opts: LabsDomainOptions = {},
): Promise<DomainHistoryPoint[]> {
  const endpoint = "dataforseo_labs/google/historical_rank_overview/live";
  const payload = { target, ...baseParams(opts) };

  const items = await withDataForSeoCache(endpoint, payload, async () => {
    const result = await dataForSeoLive<DfsItemsResult<DfsHistoricalItem>>(
      endpoint,
      payload,
    );
    return result[0]?.items ?? [];
  });

  return (items ?? [])
    .map((item): DomainHistoryPoint | null => {
      if (item.year == null || item.month == null) return null;
      return {
        month: `${item.year}-${String(item.month).padStart(2, "0")}`,
        organicTraffic:
          item.metrics?.organic?.etv != null
            ? Math.round(item.metrics.organic.etv)
            : null,
        organicKeywords: item.metrics?.organic?.count ?? null,
      };
    })
    .filter((p): p is DomainHistoryPoint => p != null)
    .sort((a, b) => (a.month < b.month ? -1 : 1))
    .slice(-24);
}

/* ------------------------------ page intersection ---------------------------- */

export type PageIntersectionRow = {
  keyword: string;
  searchVolume: number | null;
  page1Position: number | null;
  page2Position: number | null;
};

type DfsPageIntersectionItem = {
  keyword_data?: {
    keyword?: string | null;
    keyword_info?: { search_volume?: number | null } | null;
  } | null;
  first_page_intersection?: { rank_group?: number | null }[] | null;
  second_page_intersection?: { rank_group?: number | null }[] | null;
};

/**
 * Keyword yang di-ranking dua URL (halaman vs halaman) —
 * `dataforseo_labs/google/page_intersection/live`. Untuk bedah "halaman
 * kompetitor X ranking untuk keyword apa saja yang halaman kita lewatkan".
 */
export async function fetchPageIntersection(
  page1: string,
  page2: string,
  opts: LabsDomainOptions = {},
): Promise<PageIntersectionRow[]> {
  const endpoint = "dataforseo_labs/google/page_intersection/live";
  const payload = {
    pages: { "1": page1, "2": page2 },
    ...baseParams(opts),
    intersection_mode: "union",
    limit: Math.min(300, Math.max(10, opts.limit ?? 200)),
    order_by: ["keyword_data.keyword_info.search_volume,desc"],
  };

  const items = await withDataForSeoCache(endpoint, payload, async () => {
    const result = await dataForSeoLive<DfsItemsResult<DfsPageIntersectionItem>>(
      endpoint,
      payload,
    );
    return result[0]?.items ?? [];
  });

  return (items ?? [])
    .map((item): PageIntersectionRow | null => {
      const kw = item.keyword_data?.keyword?.trim();
      if (!kw) return null;
      return {
        keyword: kw,
        searchVolume: item.keyword_data?.keyword_info?.search_volume ?? null,
        page1Position: item.first_page_intersection?.[0]?.rank_group ?? null,
        page2Position: item.second_page_intersection?.[0]?.rank_group ?? null,
      };
    })
    .filter((r): r is PageIntersectionRow => r != null);
}
