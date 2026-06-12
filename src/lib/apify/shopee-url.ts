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
