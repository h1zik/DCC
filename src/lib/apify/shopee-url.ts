import "server-only";

/** Hapus query string agar actor Apify lebih stabil. */
export function cleanShopeeUrl(url: string): string {
  try {
    const u = new URL(url);
    u.search = "";
    u.hash = "";
    return u.toString().replace(/\/$/, "");
  } catch {
    return url;
  }
}

export function isShopeeProductUrl(url: string): boolean {
  return /-i\.\d+\.\d+/i.test(url) || /\/product\/\d+/i.test(url);
}

/**
 * Convert a Shopee `/product/{shopId}/{itemId}` URL (the format the Browser Scraper
 * returns in search/shop results) into the canonical `…-i.{shopId}.{itemId}` form that
 * the `shopee-product` detail actor can parse. Other formats pass through unchanged.
 *
 * Without this, feeding a search/shop result URL straight into the detail actor fails
 * with "Cannot parse shop/item id from Shopee URL".
 */
export function toShopeeDetailUrl(url: string): string {
  const m = url.match(/\/product\/(\d+)\/(\d+)/);
  if (m) return `https://shopee.co.id/product-i.${m[1]}.${m[2]}`;
  return url;
}
