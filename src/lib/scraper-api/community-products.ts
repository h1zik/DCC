import "server-only";

import type { NormalizedShopProduct } from "@/lib/apify/normalize";
import {
  isScraperApiConfigured,
  loadAllVpsRunItems,
  startVpsActorRun,
} from "@/lib/scraper-api/client";

type RawCommunityItem = {
  title?: string;
  product_url?: string;
  item_id?: string | number | null;
  price?: number | null;
  price_before_discount?: number | null;
  currency?: string | null;
  sold?: number | null;
  rating_star?: number | null;
  rating_count?: number | null;
  shop_name?: string | null;
  shop_location?: string | null;
  image_url?: string | null;
  discount?: number | null;
  is_official_shop?: boolean | null;
};

function pickNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/[^\d.-]/g, ""));
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function pickString(v: unknown): string | null {
  if (typeof v === "string" && v.trim()) return v.trim();
  return null;
}

function normalizeCommunityItem(
  raw: RawCommunityItem,
  index: number,
): NormalizedShopProduct | null {
  const name = pickString(raw.title);
  const productUrl = pickString(raw.product_url);
  if (!name || !productUrl) return null;

  const externalId =
    (typeof raw.item_id === "number"
      ? String(raw.item_id)
      : pickString(raw.item_id)) ?? `community-${index}`;

  const price = pickNumber(raw.price);
  const rating = pickNumber(raw.rating_star);
  const reviewCount = pickNumber(raw.rating_count);
  const reviewCountInt =
    reviewCount != null ? Math.round(reviewCount) : 0;

  const discountPct = pickNumber(raw.discount);
  const hasPromo = discountPct != null && discountPct > 0;
  const promoText = hasPromo ? `Diskon ${Math.round(discountPct)}%` : null;

  const shopName = pickString(raw.shop_name);
  const shopLocation = pickString(raw.shop_location);
  const imageUrl = pickString(raw.image_url);

  // FD/Sociolla tidak menyediakan data sold/revenue/stock
  return {
    externalId,
    name,
    productUrl,
    imageUrl,
    price,
    rating,
    reviewCount: reviewCountInt,
    hasPromo,
    promoText,
    categoryRank: null,
    shopName,
    soldCount: null,
    exactSold: null,
    historicalSold: null,
    monthlySold: null,
    estimatedRevenue: null,
    stock: null,
    shopLocation,
    isOfficialShop: raw.is_official_shop === true,
  };
}

async function fetchCommunityProductsViaVps(
  actorId: "femaledaily-search" | "sociolla-search",
  keyword: string,
  maxItems: number,
): Promise<NormalizedShopProduct[]> {
  if (!isScraperApiConfigured()) {
    throw new Error("SCRAPER_API_URL / SCRAPER_API_KEY belum diset.");
  }

  const target = Math.min(Math.max(maxItems, 1), 60);
  const trimmed = keyword.trim();
  if (!trimmed) return [];

  const run = await startVpsActorRun(
    actorId,
    {
      keyword: trimmed,
      limit: target,
      page: 1,
      download_images: false,
    },
    { wait: true, timeout: 180, throwOnFailed: false },
  );

  if (run.status === "failed") {
    throw new Error(
      run.error ?? `Scrape ${actorId} VPS gagal.`,
    );
  }

  const rawItems = await loadAllVpsRunItems(run);
  const out: NormalizedShopProduct[] = [];
  rawItems.forEach((raw, index) => {
    const product = normalizeCommunityItem(
      raw as RawCommunityItem,
      index,
    );
    if (product) out.push(product);
  });
  return out.slice(0, target);
}

/** Actor `femaledaily-search` di VPS — product discovery by keyword. */
export async function fetchFemaleDailySearchViaVps(
  keyword: string,
  maxItems: number,
): Promise<NormalizedShopProduct[]> {
  return fetchCommunityProductsViaVps("femaledaily-search", keyword, maxItems);
}

/** Actor `sociolla-search` di VPS — product discovery by keyword. */
export async function fetchSociollaSearchViaVps(
  keyword: string,
  maxItems: number,
): Promise<NormalizedShopProduct[]> {
  return fetchCommunityProductsViaVps("sociolla-search", keyword, maxItems);
}