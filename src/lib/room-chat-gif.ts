/** Host yang diizinkan untuk embed GIF dari URL (Tenor, Giphy, CDN Discord). */
export function isAllowedGifHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "media.discordapp.net") return true;
  if (h.endsWith(".tenor.com") || h === "tenor.com") return true;
  if (h.endsWith(".giphy.com") || h === "giphy.com") return true;
  return false;
}

export function assertSafeGifUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error("URL GIF kosong.");
  let u: URL;
  try {
    u = new URL(trimmed);
  } catch {
    throw new Error("URL GIF tidak valid.");
  }
  if (u.protocol !== "https:") {
    throw new Error("GIF harus menggunakan tautan HTTPS.");
  }
  if (!isAllowedGifHost(u.hostname)) {
    throw new Error(
      "Domain GIF tidak didukung. Gunakan tautan dari Tenor, Giphy, atau media Discord.",
    );
  }
  return u.toString();
}
