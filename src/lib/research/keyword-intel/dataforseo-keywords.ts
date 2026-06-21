import "server-only";

import {
  inferTrendFromTimelineValues,
  type KeywordTrendDirection,
} from "@/lib/research/keyword-intel/keyword-trend";

const API_BASE = "https://api.dataforseo.com/v3";
const DEFAULT_LOCATION_CODE = 2360; // Indonesia (Google Ads)
const DEFAULT_LANGUAGE_CODE = "id";
const DEFAULT_MAX_KEYWORDS = 80;

export type DfsKeywordVolume = {
  keyword: string;
  volume: number;
  /** 0–1, dari competition_index Google Ads */
  competition: number;
  /** Arah tren dari monthly_searches (12 bulan terakhir). */
  trend: KeywordTrendDirection | null;
};

export type DfsVolumeFetchResult = {
  data: DfsKeywordVolume[];
  balanceExhausted: boolean;
  errorMessage: string | null;
};

type DfsMonthlySearchItem = {
  year?: number;
  month?: number;
  search_volume?: number | null;
};

type DfsSearchVolumeItem = {
  keyword?: string;
  search_volume?: number | null;
  competition_index?: number | null;
  monthly_searches?: DfsMonthlySearchItem[] | null;
};

export function inferTrendFromDfsMonthlySearches(
  monthly: DfsMonthlySearchItem[] | null | undefined,
): KeywordTrendDirection | null {
  if (!monthly?.length) return null;

  const values = [...monthly]
    .filter(
      (m) =>
        m.search_volume != null &&
        Number.isFinite(m.search_volume) &&
        m.search_volume > 0,
    )
    .sort((a, b) => {
      const ya = a.year ?? 0;
      const yb = b.year ?? 0;
      if (ya !== yb) return ya - yb;
      return (a.month ?? 0) - (b.month ?? 0);
    })
    .map((m) => m.search_volume!);

  if (values.length < 4) return null;
  return inferTrendFromTimelineValues(values);
}

type DfsApiResponse = {
  status_code?: number;
  status_message?: string;
  tasks?: {
    status_code?: number;
    status_message?: string;
    result?: DfsSearchVolumeItem[] | null;
  }[];
};

function getCredentials(): { login: string; password: string } | null {
  const login = process.env.DATAFORSEO_LOGIN?.trim();
  const password = process.env.DATAFORSEO_PASSWORD?.trim();
  if (!login || !password) return null;
  return { login, password };
}

function authHeader(login: string, password: string): string {
  return `Basic ${Buffer.from(`${login}:${password}`).toString("base64")}`;
}

export function isDataForSeoConfigured(): boolean {
  return !!getCredentials();
}

export function getDataForSeoMaxKeywords(): number {
  const raw = Number(process.env.DATAFORSEO_MAX_KEYWORDS?.trim());
  if (Number.isFinite(raw) && raw >= 1 && raw <= 100) {
    return Math.floor(raw);
  }
  return DEFAULT_MAX_KEYWORDS;
}

function getLocationCode(): number {
  const raw = Number(process.env.DATAFORSEO_LOCATION_CODE?.trim());
  if (Number.isFinite(raw) && raw > 0) return Math.floor(raw);
  return DEFAULT_LOCATION_CODE;
}

function getLanguageCode(): string {
  return process.env.DATAFORSEO_LANGUAGE_CODE?.trim() || DEFAULT_LANGUAGE_CODE;
}

function normalizeCompetition(index: number | null | undefined): number {
  if (index == null || !Number.isFinite(index)) return 0.5;
  return Math.min(1, Math.max(0, index / 100));
}

function isBalanceError(statusCode?: number, message?: string): boolean {
  const msg = (message ?? "").toLowerCase();
  return (
    statusCode === 40200 ||
    msg.includes("balance") ||
    msg.includes("not enough") ||
    msg.includes("insufficient")
  );
}

export async function fetchKeywordVolumesFromDataForSeo(
  keywords: string[],
): Promise<DfsVolumeFetchResult> {
  const creds = getCredentials();
  if (!creds || keywords.length === 0) {
    return { data: [], balanceExhausted: false, errorMessage: null };
  }

  const unique = [...new Set(keywords.map((k) => k.trim()).filter(Boolean))];
  const batchSize = getDataForSeoMaxKeywords();
  const allData: DfsKeywordVolume[] = [];
  let balanceExhausted = false;
  let errorMessage: string | null = null;

  for (let i = 0; i < unique.length; i += batchSize) {
    const batch = unique.slice(i, i + batchSize);
    const result = await fetchKeywordVolumesBatch(creds, batch);
    allData.push(...result.data);
    if (result.balanceExhausted) {
      balanceExhausted = true;
      errorMessage = result.errorMessage;
      break;
    }
    if (result.errorMessage && result.data.length === 0 && allData.length === 0) {
      errorMessage = result.errorMessage;
    }
  }

  return { data: allData, balanceExhausted, errorMessage };
}

async function fetchKeywordVolumesBatch(
  creds: { login: string; password: string },
  keywords: string[],
): Promise<DfsVolumeFetchResult> {
  if (keywords.length === 0) {
    return { data: [], balanceExhausted: false, errorMessage: null };
  }

  try {
    const res = await fetch(
      `${API_BASE}/keywords_data/google_ads/search_volume/live`,
      {
        method: "POST",
        headers: {
          Authorization: authHeader(creds.login, creds.password),
          "Content-Type": "application/json",
        },
        body: JSON.stringify([
          {
            location_code: getLocationCode(),
            language_code: getLanguageCode(),
            search_partners: false,
            keywords,
          },
        ]),
      },
    );

    const json = (await res.json()) as DfsApiResponse;

    if (!res.ok) {
      console.warn("[dataforseo] HTTP", res.status, json.status_message);
      return {
        data: [],
        balanceExhausted: isBalanceError(json.status_code, json.status_message),
        errorMessage: json.status_message ?? `HTTP ${res.status}`,
      };
    }

    if (json.status_code !== 20000) {
      console.warn("[dataforseo] API", json.status_code, json.status_message);
      return {
        data: [],
        balanceExhausted: isBalanceError(json.status_code, json.status_message),
        errorMessage: json.status_message ?? "DataForSEO error",
      };
    }

    const task = json.tasks?.[0];
    if (!task || task.status_code !== 20000) {
      const msg = task?.status_message ?? "Task DataForSEO gagal";
      console.warn("[dataforseo] task", task?.status_code, msg);
      return {
        data: [],
        balanceExhausted: isBalanceError(task?.status_code, msg),
        errorMessage: msg,
      };
    }

    const items = task.result ?? [];
    const data: DfsKeywordVolume[] = [];

    for (const item of items) {
      const keyword = item.keyword?.trim();
      if (!keyword) continue;
      const rawVolume = item.search_volume;
      const volume =
        rawVolume == null || !Number.isFinite(rawVolume)
          ? 0
          : Math.max(0, rawVolume);

      data.push({
        keyword,
        volume,
        competition: normalizeCompetition(item.competition_index),
        trend: inferTrendFromDfsMonthlySearches(item.monthly_searches),
      });
    }

    return { data, balanceExhausted: false, errorMessage: null };
  } catch (err) {
    console.warn("[dataforseo] fetch gagal", err);
    return {
      data: [],
      balanceExhausted: false,
      errorMessage: err instanceof Error ? err.message : "DataForSEO fetch gagal",
    };
  }
}
