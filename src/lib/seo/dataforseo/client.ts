import "server-only";

/**
 * Shared low-level DataForSEO v3 client untuk modul SEO Toolkit.
 *
 * Research Hub sudah punya wrapper sempit (hanya `keywords_data/.../search_volume`)
 * di `src/lib/research/keyword-intel/dataforseo-keywords.ts`. Modul SEO butuh
 * banyak endpoint (Labs, SERP, On-Page, Backlinks), jadi di sini kita sediakan
 * core bersama: auth Basic, request + retry/backoff, deteksi error saldo, dan
 * resolusi lokasi/bahasa Indonesia default. Wrapper per-endpoint memakai core ini.
 */

import { recordDataForSeoUsage } from "@/lib/seo/dataforseo/usage";

const API_BASE = "https://api.dataforseo.com/v3";
const DEFAULT_LOCATION_CODE = 2360; // Indonesia (Google)
const DEFAULT_LANGUAGE_CODE = "id";

/** Status code DataForSEO yang berarti OK (top-level & task-level). */
export const DFS_OK = 20000;
/** Task masih diproses (metode standard/queue). */
export const DFS_TASK_IN_QUEUE = 40601;
export const DFS_TASK_IN_PROGRESS = 40602;

export class DataForSeoError extends Error {
  readonly statusCode: number | null;
  /** True bila kegagalan karena saldo akun DataForSEO habis. */
  readonly balanceExhausted: boolean;

  constructor(
    message: string,
    opts?: { statusCode?: number | null; balanceExhausted?: boolean },
  ) {
    super(message);
    this.name = "DataForSeoError";
    this.statusCode = opts?.statusCode ?? null;
    this.balanceExhausted = opts?.balanceExhausted ?? false;
  }
}

export type DfsTask<T> = {
  id?: string;
  status_code?: number;
  status_message?: string;
  result?: T[] | null;
  result_count?: number;
};

export type DfsResponse<T> = {
  status_code?: number;
  status_message?: string;
  cost?: number;
  tasks?: DfsTask<T>[];
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

export function getDataForSeoLocationCode(): number {
  const raw = Number(process.env.DATAFORSEO_LOCATION_CODE?.trim());
  if (Number.isFinite(raw) && raw > 0) return Math.floor(raw);
  return DEFAULT_LOCATION_CODE;
}

export function getDataForSeoLanguageCode(): string {
  return process.env.DATAFORSEO_LANGUAGE_CODE?.trim() || DEFAULT_LANGUAGE_CODE;
}

/**
 * Validasi rasio `keyword_info.competition` DataForSEO (sudah berskala 0–1).
 *
 * Jangan samakan field ini dengan `competition_index` dari Keywords Data yang
 * berskala 0–100 dan memang perlu dibagi 100.
 */
export function normalizeCompetition(
  value: number | null | undefined,
): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return Math.min(1, Math.max(0, value));
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

function isTransientStatus(status: number): boolean {
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type RequestOpts = {
  /** Jumlah retry untuk error transien (default 2). */
  maxRetries?: number;
  /** Delay dasar backoff dalam ms (default 800). */
  baseDelayMs?: number;
};

/**
 * Kirim POST ke endpoint DataForSEO dengan body array task. Mengembalikan
 * respons mentah (sudah dicek HTTP + status top-level). Retry otomatis untuk
 * error transien (429/5xx/jaringan) dengan exponential backoff.
 *
 * @throws DataForSeoError bila kredensial kosong, saldo habis, atau HTTP error.
 */
export async function dataForSeoRequest<T>(
  endpoint: string,
  body: unknown[],
  opts: RequestOpts = {},
): Promise<DfsResponse<T>> {
  const creds = getCredentials();
  if (!creds) {
    throw new DataForSeoError(
      "DataForSEO belum dikonfigurasi (set DATAFORSEO_LOGIN & DATAFORSEO_PASSWORD).",
    );
  }

  const maxRetries = opts.maxRetries ?? 2;
  const baseDelayMs = opts.baseDelayMs ?? 800;
  const url = `${API_BASE}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;

  let lastErr: unknown = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: authHeader(creds.login, creds.password),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const json = (await res.json().catch(() => null)) as DfsResponse<T> | null;

      if (!res.ok) {
        const balance = isBalanceError(json?.status_code, json?.status_message);
        // Retry transien hanya bila bukan error saldo.
        if (isTransientStatus(res.status) && !balance && attempt < maxRetries) {
          await delay(baseDelayMs * 2 ** attempt);
          continue;
        }
        throw new DataForSeoError(
          json?.status_message ?? `DataForSEO HTTP ${res.status}`,
          { statusCode: json?.status_code ?? res.status, balanceExhausted: balance },
        );
      }

      if (!json) {
        throw new DataForSeoError("DataForSEO mengembalikan respons non-JSON.");
      }

      if (json.status_code !== DFS_OK) {
        const balance = isBalanceError(json.status_code, json.status_message);
        throw new DataForSeoError(
          json.status_message ?? "DataForSEO error.",
          { statusCode: json.status_code ?? null, balanceExhausted: balance },
        );
      }

      recordDataForSeoUsage(endpoint, json.cost, body.length);
      return json;
    } catch (err) {
      lastErr = err;
      // Error saldo / HTTP final → jangan retry.
      if (err instanceof DataForSeoError) {
        if (err.balanceExhausted || err.statusCode != null) throw err;
      }
      // Error jaringan → retry dengan backoff.
      if (attempt < maxRetries) {
        await delay(baseDelayMs * 2 ** attempt);
        continue;
      }
    }
  }

  throw lastErr instanceof Error
    ? new DataForSeoError(lastErr.message)
    : new DataForSeoError("DataForSEO request gagal.");
}

/**
 * GET ke endpoint DataForSEO (mis. `on_page/summary/{id}`). Beberapa endpoint
 * On-Page memakai GET dengan id di path. Retry transien sama seperti POST.
 *
 * @throws DataForSeoError bila kredensial kosong, saldo habis, atau HTTP error.
 */
export async function dataForSeoGet<T>(
  endpoint: string,
  opts: RequestOpts = {},
): Promise<DfsResponse<T>> {
  const creds = getCredentials();
  if (!creds) {
    throw new DataForSeoError(
      "DataForSEO belum dikonfigurasi (set DATAFORSEO_LOGIN & DATAFORSEO_PASSWORD).",
    );
  }

  const maxRetries = opts.maxRetries ?? 2;
  const baseDelayMs = opts.baseDelayMs ?? 800;
  const url = `${API_BASE}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;

  let lastErr: unknown = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, {
        method: "GET",
        headers: { Authorization: authHeader(creds.login, creds.password) },
      });
      const json = (await res.json().catch(() => null)) as DfsResponse<T> | null;

      if (!res.ok) {
        const balance = isBalanceError(json?.status_code, json?.status_message);
        if (isTransientStatus(res.status) && !balance && attempt < maxRetries) {
          await delay(baseDelayMs * 2 ** attempt);
          continue;
        }
        throw new DataForSeoError(
          json?.status_message ?? `DataForSEO HTTP ${res.status}`,
          { statusCode: json?.status_code ?? res.status, balanceExhausted: balance },
        );
      }
      if (!json) throw new DataForSeoError("DataForSEO mengembalikan respons non-JSON.");
      if (json.status_code !== DFS_OK) {
        throw new DataForSeoError(json.status_message ?? "DataForSEO error.", {
          statusCode: json.status_code ?? null,
          balanceExhausted: isBalanceError(json.status_code, json.status_message),
        });
      }
      recordDataForSeoUsage(endpoint, json.cost);
      return json;
    } catch (err) {
      lastErr = err;
      if (err instanceof DataForSeoError) {
        if (err.balanceExhausted || err.statusCode != null) throw err;
      }
      if (attempt < maxRetries) {
        await delay(baseDelayMs * 2 ** attempt);
        continue;
      }
    }
  }

  throw lastErr instanceof Error
    ? new DataForSeoError(lastErr.message)
    : new DataForSeoError("DataForSEO request gagal.");
}

/**
 * Helper untuk endpoint "live": kirim satu task dan kembalikan `tasks[0].result`.
 * @throws DataForSeoError bila task gagal.
 */
export async function dataForSeoLive<T>(
  endpoint: string,
  payload: Record<string, unknown>,
  opts?: RequestOpts,
): Promise<T[]> {
  const json = await dataForSeoRequest<T>(endpoint, [payload], opts);
  const task = json.tasks?.[0];
  if (!task || task.status_code !== DFS_OK) {
    throw new DataForSeoError(task?.status_message ?? "Task DataForSEO gagal.", {
      statusCode: task?.status_code ?? null,
      balanceExhausted: isBalanceError(task?.status_code, task?.status_message),
    });
  }
  return task.result ?? [];
}
