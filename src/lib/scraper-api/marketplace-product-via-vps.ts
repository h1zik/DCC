import "server-only";

import { ResearchMarketplace } from "@prisma/client";
import { isScraperApiConfigured } from "@/lib/scraper-api/client";
import { fetchShopeeProductViaVps } from "@/lib/scraper-api/shopee-products";
import { fetchTokopediaProductViaVps } from "@/lib/scraper-api/tokopedia-products";
import type { NormalizedShopProduct } from "@/lib/apify/normalize";

/** VPS product detail — pasangan URL dari actor search Product Discovery. */
export async function fetchMarketplaceProductViaVps(
  marketplace: ResearchMarketplace,
  productUrl: string,
): Promise<NormalizedShopProduct> {
  if (!isScraperApiConfigured()) {
    throw new Error("SCRAPER_API_URL / SCRAPER_API_KEY belum diset.");
  }

  switch (marketplace) {
    case ResearchMarketplace.SHOPEE:
      return fetchShopeeProductViaVps(productUrl);
    case ResearchMarketplace.TOKOPEDIA:
      return fetchTokopediaProductViaVps(productUrl);
    case ResearchMarketplace.TIKTOK_SHOP:
      throw new Error(
        "TikTok Shop product URL via VPS belum didukung. Gunakan Shopee/Tokopedia atau fallback Apify.",
      );
    default:
      throw new Error("Marketplace tidak didukung untuk scrape produk VPS.");
  }
}
