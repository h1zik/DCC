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

function shopeeRowId(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "string" && /^\d+$/.test(value.trim())) return value.trim();
  return null;
}

/**
 * Baris detail xtracto (`fetchDetail: true`) tidak membawa `url` — hanya
 * `shop_id` + `item_id`. Tanpa URL, normalizer membuang barisnya, jadi URL
 * kanonik `…-i.{shopId}.{itemId}` dibangun dari ID. Baris yang sudah punya URL
 * dibiarkan apa adanya.
 */
export function withShopeeProductUrls(
  items: Record<string, unknown>[],
  host = "shopee.co.id",
): Record<string, unknown>[] {
  return items.map((item) => {
    if (typeof item.url === "string" && item.url.trim()) return item;
    const shopId = shopeeRowId(item.shop_id);
    const itemId = shopeeRowId(item.item_id);
    if (!shopId || !itemId) return item;
    return { ...item, url: `https://${host}/product-i.${shopId}.${itemId}` };
  });
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
