import "server-only";

const API_BASE = "https://api.dataforseo.com/v3";
const DEFAULT_LOCATION_CODE = 2360; // Indonesia (Google Ads)
const DEFAULT_LANGUAGE_CODE = "id";
const DEFAULT_MAX_KEYWORDS = 30;

export type DfsKeywordVolume = {
  keyword: string;
  volume: number;
  /** 0–1, dari competition_index Google Ads */
  competition: number;
};

export type DfsVolumeFetchResult = {
  data: DfsKeywordVolume[];
  balanceExhausted: boolean;
  errorMessage: string | null;
};

type DfsSearchVolumeItem = {
  keyword?: string;
  search_volume?: number | null;
  competition_index?: number | null;
};

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

  const unique = [...new Set(keywords.map((k) => k.trim()).filter(Boolean))].slice(
    0,
    getDataForSeoMaxKeywords(),
  );

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
            keywords: unique,
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
      const volume = item.search_volume;
      if (volume == null || !Number.isFinite(volume)) continue;

      data.push({
        keyword,
        volume,
        competition: normalizeCompetition(item.competition_index),
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
