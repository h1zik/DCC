import "server-only";

import { ResearchMarketplace } from "@prisma/client";
import { isShopeeProductUrl } from "@/lib/apify/shopee-url";

export function detectMarketplaceFromProductUrl(
  url: string,
): ResearchMarketplace | null {
  const lower = url.toLowerCase();
  if (lower.includes("shopee.")) return ResearchMarketplace.SHOPEE;
  if (lower.includes("tokopedia.com")) return ResearchMarketplace.TOKOPEDIA;
  if (lower.includes("lazada.")) return ResearchMarketplace.LAZADA;
  if (lower.includes("tiktok.com")) return ResearchMarketplace.TIKTOK_SHOP;
  return null;
}

export function validateCompetitorProductUrl(
  url: string,
  marketplace: ResearchMarketplace,
): string | null {
  try {
    new URL(url);
  } catch {
    return "URL tidak valid.";
  }

  if (marketplace === ResearchMarketplace.SHOPEE && !isShopeeProductUrl(url)) {
    return "URL produk Shopee diperlukan (bukan URL toko). Contoh: https://shopee.co.id/product/...";
  }

  if (
    marketplace === ResearchMarketplace.TOKOPEDIA &&
    !/tokopedia\.com/i.test(url)
  ) {
    return "URL harus dari tokopedia.com.";
  }

  if (marketplace === ResearchMarketplace.LAZADA && !/lazada\./i.test(url)) {
    return "URL harus dari lazada.* (contoh: https://www.lazada.co.id/products/...).";
  }

  if (
    marketplace === ResearchMarketplace.TIKTOK_SHOP &&
    !/tiktok\.com/i.test(url)
  ) {
    return "URL harus dari tiktok.com (TikTok Shop).";
  }

  return null;
}
