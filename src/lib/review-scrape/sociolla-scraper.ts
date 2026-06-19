import type { NormalizedReview } from "@/lib/apify/normalize";

const SOCIOLLA_HOST = "www.sociolla.com";
const CATALOG_API = "https://catalog-api.sociolla.com/v3/products";
const SOCO_REVIEWS_API = "https://soco-api.sociolla.com/reviews";
const SOCO_REVIEWS_COUNT_API = "https://soco-api.sociolla.com/reviews/count";
const BJ_REVIEWS_API = "https://bj-public-api.sociolla.com/reviews";
const DEFAULT_MAX_PAGES = 50;
const DEFAULT_MAX_REVIEWS = 500;
const PAGE_SIZE = 20;
const PAGE_DELAY_MS = 300;

const FETCH_HEADERS: HeadersInit = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "application/json",
  Referer: "https://www.sociolla.com/",
  Origin: "https://www.sociolla.com",
};

const CATALOG_HEADERS: HeadersInit = {
  ...FETCH_HEADERS,
  "SOC-PLATFORM": "sociolla-web-desktop",
};

export type SociollaScrapeOptions = {
  maxPages?: number;
  maxReviews?: number;
};

export type SociollaScrapeResult = {
  reviews: NormalizedReview[];
  totalReported: number | null;
  pagesFetched: number;
  complete: boolean;
};

type SociollaReviewUser = {
  name?: string;
  user_name?: string;
};

type SociollaReviewItem = {
  _id?: string;
  details?: string;
  average_rating?: number;
  created_at?: string;
  user?: SociollaReviewUser;
};

type SociollaReviewsResponse = {
  success?: boolean;
  data?: SociollaReviewItem[];
  errorCode?: string;
  message?: string;
};

type SociollaCatalogProduct = {
  id?: number;
  my_sociolla_sql_id?: number;
  slug?: string;
  name?: string;
  review_stats?: { total_reviews?: number };
  default_combination?: { slug?: string; url_sociolla?: string };
  combinations?: { slug?: string }[];
  url_sociolla?: string;
};

type SociollaCatalogResponse = {
  success?: boolean;
  data?: SociollaCatalogProduct;
  errorCode?: string;
};

function parseSociollaUrl(rawUrl: string): URL {
  const trimmed = rawUrl.trim();
  try {
    return new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
  } catch {
    throw new Error("URL Sociolla tidak valid.");
  }
}

function normalizeSociollaHost(parsed: URL): URL {
  const host = parsed.hostname.toLowerCase();
  if (!host.includes("sociolla.com")) {
    throw new Error("URL harus dari www.sociolla.com.");
  }
  if (host !== SOCIOLLA_HOST && host.endsWith("sociolla.com")) {
    parsed.hostname = SOCIOLLA_HOST;
  }
  parsed.protocol = "https:";
  return parsed;
}

/** Ambil segmen slug produk dari path (tanpa `.html`). */
export function extractSociollaSlugSegment(pathname: string): string | null {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return null;

  const reserved = new Set(["p", "product", "en", "id"]);
  const candidates = [...segments].reverse().filter((s) => !reserved.has(s.toLowerCase()));
  const raw = candidates[0] ?? segments[segments.length - 1];
  const slug = raw.replace(/\.html$/i, "").trim();
  return slug || null;
}

/** ID dari segmen slug format `94687-nama-produk`. */
export function extractSociollaIdFromSlugSegment(segment: string): string | null {
  const match = segment.match(/^(\d{3,})-/);
  return match?.[1] ?? null;
}

/** ID numerik dari segmen path (`/serum/94687/...`). */
export function extractSociollaIdFromPathSegments(segments: string[]): string | null {
  for (const segment of segments) {
    const clean = segment.replace(/\.html$/i, "");
    if (/^\d{3,}$/.test(clean)) {
      return clean;
    }
  }
  return null;
}

async function fetchCatalogProductBySlug(
  slug: string,
): Promise<SociollaCatalogProduct | null> {
  const encoded = encodeURIComponent(slug.replace(/\.html$/i, ""));
  const res = await fetch(`${CATALOG_API}/${encoded}`, {
    headers: CATALOG_HEADERS,
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) return null;

  const json = (await res.json()) as SociollaCatalogResponse;
  if (!json.success || !json.data?.my_sociolla_sql_id) return null;
  return json.data;
}

function slugMatchesProduct(product: SociollaCatalogProduct, target: string): boolean {
  const normalized = target.replace(/\.html$/i, "").toLowerCase();
  const slugs = new Set<string>();
  if (product.slug) slugs.add(product.slug.toLowerCase());
  if (product.default_combination?.slug) {
    slugs.add(product.default_combination.slug.toLowerCase());
  }
  for (const combo of product.combinations ?? []) {
    if (combo.slug) slugs.add(combo.slug.toLowerCase());
  }

  if (slugs.has(normalized)) return true;

  const withoutPrefix = normalized.replace(/^\d+-/, "");
  for (const slug of slugs) {
    if (slug === normalized || slug.endsWith(withoutPrefix) || slug.includes(withoutPrefix)) {
      return true;
    }
  }

  const urlSoc = product.url_sociolla ?? product.default_combination?.url_sociolla;
  return !!urlSoc && urlSoc.toLowerCase().includes(normalized);
}

async function resolveSociollaCatalogProduct(
  productUrl: string,
): Promise<SociollaCatalogProduct> {
  const parsed = normalizeSociollaHost(parseSociollaUrl(productUrl));
  const slugSegment = extractSociollaSlugSegment(parsed.pathname);

  if (slugSegment) {
    const fromCatalog = await fetchCatalogProductBySlug(slugSegment);
    if (fromCatalog) return fromCatalog;
  }

  const sqlId = await resolveSociollaProductId(productUrl);
  if (slugSegment) {
    const fromSearch = await searchCatalogProductBySlug(slugSegment);
    if (fromSearch) {
      const fromCatalog = await fetchCatalogProductBySlug(slugSegment);
      if (fromCatalog) return fromCatalog;
      return { my_sociolla_sql_id: fromSearch };
    }
  }

  return { my_sociolla_sql_id: Number(sqlId) };
}

/** ID internal catalog untuk API review (`product.id`, bukan `my_sociolla_sql_id`). */
function sociollaReviewProductId(product: SociollaCatalogProduct): number {
  if (typeof product.id === "number" && Number.isFinite(product.id)) {
    return product.id;
  }
  if (
    typeof product.my_sociolla_sql_id === "number" &&
    Number.isFinite(product.my_sociolla_sql_id)
  ) {
    return product.my_sociolla_sql_id;
  }
  throw new Error("ID produk Sociolla tidak ditemukan untuk fetch review.");
}

async function fetchSociollaReviewCount(reviewProductId: number): Promise<number | null> {
  const filter = JSON.stringify({
    is_published: true,
    elastic_search: true,
    product_id: reviewProductId,
  });
  const url = `${SOCO_REVIEWS_COUNT_API}?filter=${encodeURIComponent(filter)}`;

  try {
    const res = await fetch(url, {
      headers: FETCH_HEADERS,
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: number };
    return typeof json.data === "number" ? json.data : null;
  } catch {
    return null;
  }
}
async function searchCatalogProductBySlug(slug: string): Promise<number | null> {
  const query = slug.replace(/\.html$/i, "").replace(/-/g, " ").trim();
  if (!query) return null;

  const url = new URL("https://catalog-api.sociolla.com/v3/search");
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "40");

  const res = await fetch(url.toString(), {
    headers: CATALOG_HEADERS,
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) return null;

  const json = (await res.json()) as { data?: SociollaCatalogProduct[] };
  for (const product of json.data ?? []) {
    if (slugMatchesProduct(product, slug) && product.my_sociolla_sql_id) {
      return product.my_sociolla_sql_id;
    }
  }
  return null;
}

/** Resolve `my_sociolla_sql_id` dari berbagai format URL Sociolla. */
export async function resolveSociollaProductId(productUrl: string): Promise<string> {
  const parsed = normalizeSociollaHost(parseSociollaUrl(productUrl));
  const segments = parsed.pathname.split("/").filter(Boolean);
  const slugSegment = extractSociollaSlugSegment(parsed.pathname);

  if (slugSegment) {
    const fromSlugPrefix = extractSociollaIdFromSlugSegment(slugSegment);
    if (fromSlugPrefix) return fromSlugPrefix;

    const fromCatalog = await fetchCatalogProductBySlug(slugSegment);
    if (fromCatalog?.my_sociolla_sql_id) {
      return String(fromCatalog.my_sociolla_sql_id);
    }

    const fromSearch = await searchCatalogProductBySlug(slugSegment);
    if (fromSearch) return String(fromSearch);
  }

  const fromPath = extractSociollaIdFromPathSegments(segments);
  if (fromPath) return fromPath;

  throw new Error(
    "Tidak menemukan ID produk di URL Sociolla. Salin URL lengkap dari browser (contoh: https://www.sociolla.com/body-serum/94687-nama-produk.html).",
  );
}

/** @deprecated Gunakan `resolveSociollaProductId` — sync extract saja untuk URL lama. */
export function extractSociollaProductId(productUrl: string): string | null {
  try {
    const parsed = normalizeSociollaHost(parseSociollaUrl(productUrl));
    const slugSegment = extractSociollaSlugSegment(parsed.pathname);
    if (slugSegment) {
      const fromSlug = extractSociollaIdFromSlugSegment(slugSegment);
      if (fromSlug) return fromSlug;
    }
    return extractSociollaIdFromPathSegments(parsed.pathname.split("/").filter(Boolean));
  } catch {
    return null;
  }
}

export async function normalizeSociollaProductUrl(rawUrl: string): Promise<string> {
  const parsed = normalizeSociollaHost(parseSociollaUrl(rawUrl));
  await resolveSociollaProductId(parsed.toString());
  return parsed.toString();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseReviewDate(raw: string | undefined): Date | null {
  if (!raw?.trim()) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function normalizeReviewItem(item: SociollaReviewItem): NormalizedReview | null {
  const text = item.details?.trim() ?? "";
  if (!text) return null;

  const author =
    item.user?.name?.trim() ||
    item.user?.user_name?.trim() ||
    null;

  const rating =
    typeof item.average_rating === "number" && Number.isFinite(item.average_rating)
      ? item.average_rating
      : null;

  return {
    externalId: item._id ?? `${author ?? "anon"}-${text.slice(0, 24)}`,
    author,
    rating,
    text,
    reviewDate: parseReviewDate(item.created_at),
  };
}

async function fetchSocoReviewPage(
  reviewProductId: number,
  skip: number,
): Promise<SociollaReviewItem[]> {
  const filter = JSON.stringify({
    is_published: true,
    elastic_search: true,
    product_id: reviewProductId,
  });
  const url = new URL(SOCO_REVIEWS_API);
  url.searchParams.set("filter", filter);
  url.searchParams.set("sort", "-created_at");
  url.searchParams.set("limit", String(PAGE_SIZE));
  url.searchParams.set("skip", String(skip));

  const res = await fetch(url.toString(), {
    headers: FETCH_HEADERS,
    signal: AbortSignal.timeout(45_000),
  });

  if (!res.ok) {
    throw new Error(`Sociolla reviews API gagal (${res.status}).`);
  }

  const json = (await res.json()) as SociollaReviewsResponse;
  if (json.success === false) {
    const msg = json.errorCode || json.message || "Sociolla reviews API error.";
    throw new Error(msg);
  }

  return Array.isArray(json.data) ? json.data : [];
}

async function fetchBjReviewPage(
  productId: string,
  skip: number,
): Promise<SociollaReviewItem[]> {
  const url = new URL(BJ_REVIEWS_API);
  url.searchParams.set("product_id", productId);
  url.searchParams.set("limit", String(PAGE_SIZE));
  url.searchParams.set("skip", String(skip));

  const res = await fetch(url.toString(), {
    headers: FETCH_HEADERS,
    signal: AbortSignal.timeout(45_000),
  });

  if (!res.ok) {
    throw new Error(`Sociolla reviews API gagal (${res.status}).`);
  }

  const json = (await res.json()) as SociollaReviewsResponse;
  if (!json.success) {
    const msg = json.errorCode || json.message || "Sociolla reviews API error.";
    throw new Error(msg);
  }

  return Array.isArray(json.data) ? json.data : [];
}

export async function scrapeSociollaReviews(
  productUrl: string,
  opts?: SociollaScrapeOptions,
): Promise<SociollaScrapeResult> {
  await normalizeSociollaProductUrl(productUrl);
  const catalogProduct = await resolveSociollaCatalogProduct(productUrl);
  const reviewProductId = sociollaReviewProductId(catalogProduct);
  const sqlProductId = String(
    catalogProduct.my_sociolla_sql_id ?? reviewProductId,
  );

  const maxPages = opts?.maxPages ?? DEFAULT_MAX_PAGES;
  const maxReviews = opts?.maxReviews ?? DEFAULT_MAX_REVIEWS;

  const totalFromApi = await fetchSociollaReviewCount(reviewProductId);
  const totalReported =
    totalFromApi ??
    catalogProduct.review_stats?.total_reviews ??
    null;

  const all: NormalizedReview[] = [];
  const seen = new Set<string>();
  let pagesFetched = 0;
  let complete = true;
  let useSocoApi = true;

  for (let page = 0; page < maxPages; page += 1) {
    if (page > 0) await sleep(PAGE_DELAY_MS);

    const skip = page * PAGE_SIZE;
    let batchRaw: SociollaReviewItem[];

    if (useSocoApi) {
      batchRaw = await fetchSocoReviewPage(reviewProductId, skip);
      if (page === 0 && batchRaw.length === 0) {
        useSocoApi = false;
        batchRaw = await fetchBjReviewPage(sqlProductId, 0);
      }
    } else {
      batchRaw = await fetchBjReviewPage(sqlProductId, skip);
    }

    pagesFetched += 1;

    if (batchRaw.length === 0) break;

    for (const item of batchRaw) {
      const review = normalizeReviewItem(item);
      if (!review) continue;
      if (seen.has(review.externalId)) continue;
      seen.add(review.externalId);
      all.push(review);
      if (all.length >= maxReviews) {
        complete = false;
        break;
      }
    }

    if (all.length >= maxReviews) break;
    if (batchRaw.length < PAGE_SIZE) break;
    if (page === maxPages - 1) complete = false;
  }

  if (totalReported != null && all.length >= totalReported && all.length <= maxReviews) {
    complete = true;
  }

  return {
    reviews: all,
    totalReported: totalReported ?? all.length,
    pagesFetched,
    complete,
  };
}
