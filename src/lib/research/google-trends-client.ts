import "server-only";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const googleTrends = require("google-trends-api") as {
  relatedQueries: (opts: Record<string, unknown>) => Promise<string>;
  interestOverTime: (opts: Record<string, unknown>) => Promise<string>;
};

const REQUEST_GAP_MS = 2800;
const MAX_RETRIES = 2;
const RETRY_BASE_MS = 2500;
/** Setelah diblokir Google, jangan panggil API lagi dalam window ini. */
const CIRCUIT_COOLDOWN_MS = 30 * 60 * 1000;

export type RelatedQueriesPayload = {
  default?: {
    rankedList?: {
      rankedKeyword?: { query?: string; value?: number }[];
    }[];
  };
};

let trendsCircuitOpenUntil = 0;
let lastBlockLoggedAt = 0;

export function trendsSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sleep(ms: number): Promise<void> {
  return trendsSleep(ms);
}

export function isGoogleTrendsCircuitOpen(): boolean {
  return Date.now() < trendsCircuitOpenUntil;
}

export function getGoogleTrendsUnavailableNotice(): string {
  return "Google Trends diblokir sementara (rate limit/CAPTCHA dari IP server). Trend keyword memakai perkiraan dari Shopee autocomplete.";
}

function openGoogleTrendsCircuit(reason: string): void {
  trendsCircuitOpenUntil = Date.now() + CIRCUIT_COOLDOWN_MS;
  const now = Date.now();
  if (now - lastBlockLoggedAt > 60_000) {
    lastBlockLoggedAt = now;
    console.warn(`[google-trends] ${reason} — skip request Trends ~30 menit`);
  }
}

export function isHtmlTrendsResponse(raw: string): boolean {
  const t = raw.trim().toLowerCase();
  return (
    t.startsWith("<!doctype") ||
    t.startsWith("<html") ||
    t.includes("google.com/sorry") ||
    t.includes("302 moved")
  );
}

export function isBlockedTrendsError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = `${err.message} ${"requestBody" in err ? String((err as { requestBody?: unknown }).requestBody ?? "") : ""}`.toLowerCase();
  return (
    msg.includes("not valid json") ||
    msg.includes("unexpected token") ||
    msg.includes("google.com/sorry") ||
    msg.includes("<html") ||
    msg.includes("302 moved")
  );
}

function safeParseJson<T>(raw: string): T | null {
  if (!raw || isHtmlTrendsResponse(raw)) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function handleBlockedResponse(): null {
  openGoogleTrendsCircuit("respons HTML / CAPTCHA");
  return null;
}

async function withRetry(fn: () => Promise<string>): Promise<string | null> {
  if (isGoogleTrendsCircuitOpen()) return null;

  let lastRaw: string | null = null;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const raw = await fn();
      lastRaw = raw;
      if (isHtmlTrendsResponse(raw)) {
        if (attempt < MAX_RETRIES - 1) {
          await sleep(RETRY_BASE_MS * (attempt + 1));
          continue;
        }
        return handleBlockedResponse();
      }
      return raw;
    } catch (err) {
      if (isBlockedTrendsError(err)) {
        return handleBlockedResponse();
      }
      if (attempt === MAX_RETRIES - 1) {
        console.warn("[google-trends] request gagal setelah retry", err);
      }
      if (attempt < MAX_RETRIES - 1) {
        await sleep(RETRY_BASE_MS * (attempt + 1));
      }
    }
  }
  if (lastRaw && !isHtmlTrendsResponse(lastRaw)) return lastRaw;
  return null;
}

export async function fetchRelatedQueriesPayload(
  keyword: string,
): Promise<RelatedQueriesPayload | null> {
  if (isGoogleTrendsCircuitOpen()) return null;

  const raw = await withRetry(() =>
    googleTrends.relatedQueries({
      keyword,
      geo: "ID",
      hl: "id",
    }),
  );
  if (!raw) return null;

  const parsed = safeParseJson<RelatedQueriesPayload>(raw);
  if (!parsed) {
    openGoogleTrendsCircuit("JSON invalid / block");
  }
  return parsed;
}

export async function fetchInterestOverTimePayload(
  keyword: string,
  startTime: Date,
): Promise<{
  default?: {
    timelineData?: { value?: number[]; formattedTime?: string; time?: string }[];
  };
} | null> {
  if (isGoogleTrendsCircuitOpen()) return null;

  const raw = await withRetry(() =>
    googleTrends.interestOverTime({
      keyword,
      geo: "ID",
      startTime,
    }),
  );
  if (!raw) return null;
  return safeParseJson(raw);
}

/** Google Trends sensitif rate limit — jangan paralelkan banyak keyword. */
export async function forEachTrendsKeywordSequential<T>(
  keywords: string[],
  fn: (keyword: string) => Promise<T>,
): Promise<T[]> {
  const results: T[] = [];
  for (let i = 0; i < keywords.length; i++) {
    if (isGoogleTrendsCircuitOpen()) break;
    if (i > 0) await sleep(REQUEST_GAP_MS);
    results.push(await fn(keywords[i]!));
  }
  return results;
}
