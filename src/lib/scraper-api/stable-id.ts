/**
 * Derive a stable external id from a product URL.
 *
 * Marketplace product URLs embed the item id in the path and are stable across scrapes,
 * unlike array-index fallbacks (`shp-0`, `tkp-3`) which shift whenever the scraper drops
 * an item or reorders results — fabricating "new SKU" alerts and severing price history.
 *
 * The query string is stripped because it commonly carries volatile tracking params.
 */
export function stableUrlKey(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  const withoutQuery = trimmed.split(/[?#]/)[0]!;
  const normalized = withoutQuery.replace(/^https?:\/\//, "").replace(/\/+$/, "");
  return normalized ? `url:${normalized}` : null;
}
