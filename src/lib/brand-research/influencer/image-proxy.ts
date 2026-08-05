/**
 * Proxy gambar CDN sosial media.
 *
 * CDN Instagram (`*.cdninstagram.com`, `*.fbcdn.net`) menolak permintaan
 * gambar yang datang langsung dari browser di domain lain, sehingga foto
 * profil dan thumbnail post tampil kosong. CDN TikTok lebih longgar — karena
 * itu TikTok terlihat normal sementara Instagram tidak.
 *
 * Solusinya mengambil gambar dari sisi server (server-ke-server tidak terkena
 * pembatasan referer/CORS) lalu meneruskannya ke browser.
 */

/**
 * Host yang boleh diambil. Daftar ini adalah penjaga SSRF — tanpa itu,
 * endpoint proxy bisa dipakai membaca alamat internal jaringan.
 */
const ALLOWED_HOST_SUFFIXES = [
  // Instagram / Meta
  ".cdninstagram.com",
  ".fbcdn.net",
  "cdninstagram.com",
  // TikTok
  ".tiktokcdn.com",
  ".tiktokcdn-us.com",
  ".tiktokcdn-eu.com",
  ".tiktokv.com",
  ".ibyteimg.com",
  ".byteoversea.com",
  ".muscdn.com",
];

export function isProxyableImageHost(rawUrl: string): boolean {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;

  const host = url.hostname.toLowerCase();
  return ALLOWED_HOST_SUFFIXES.some((suffix) =>
    suffix.startsWith(".") ? host.endsWith(suffix) : host === suffix,
  );
}

/**
 * Ubah URL CDN jadi URL proxy internal. URL yang tidak dikenal dikembalikan
 * apa adanya supaya gambar dari sumber lain tetap tampil seperti biasa.
 */
export function influencerImageSrc(
  rawUrl: string | null | undefined,
): string | null {
  if (!rawUrl) return null;
  if (!isProxyableImageHost(rawUrl)) return rawUrl;
  return `/api/brand-hub/influencer-image?url=${encodeURIComponent(rawUrl)}`;
}
