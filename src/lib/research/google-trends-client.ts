import "server-only";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const googleTrends = require("google-trends-api") as {
  relatedQueries: (opts: Record<string, unknown>) => Promise<string>;
  interestOverTime: (opts: Record<string, unknown>) => Promise<string>;
};

const REQUEST_GAP_MS = 2800;
const MAX_RETRIES = 3;
const RETRY_BASE_MS = 2000;

export type RelatedQueriesPayload = {
  default?: {
    rankedList?: {
      rankedKeyword?: { query?: string; value?: number }[];
    }[];
  };
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isHtmlTrendsResponse(raw: string): boolean {
  const t = raw.trim().toLowerCase();
  return t.startsWith("<!doctype") || t.startsWith("<html");
}

function safeParseJson<T>(raw: string): T | null {
  if (!raw || isHtmlTrendsResponse(raw)) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function withRetry(fn: () => Promise<string>): Promise<string | null> {
  let lastRaw: string | null = null;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const raw = await fn();
      lastRaw = raw;
      if (isHtmlTrendsResponse(raw)) {
        console.warn(
          `[google-trends] respons HTML (rate limit / block), retry ${attempt + 1}/${MAX_RETRIES}`,
        );
        if (attempt < MAX_RETRIES - 1) {
          await sleep(RETRY_BASE_MS * (attempt + 1));
          continue;
        }
        return null;
      }
      return raw;
    } catch (err) {
      console.warn(`[google-trends] request gagal attempt ${attempt + 1}`, err);
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
  const raw = await withRetry(() =>
    googleTrends.relatedQueries({
      keyword,
      geo: "ID",
      hl: "id",
    }),
  );
  if (!raw) {
    console.warn("[google-trends] relatedQueries kosong:", keyword);
    return null;
  }
  const parsed = safeParseJson<RelatedQueriesPayload>(raw);
  if (!parsed) {
    console.warn("[google-trends] JSON invalid untuk:", keyword);
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
    if (i > 0) await sleep(REQUEST_GAP_MS);
    results.push(await fn(keywords[i]!));
  }
  return results;
}
