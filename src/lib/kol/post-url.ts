/**
 * Kenali link post Instagram/TikTok dan ambil kunci unik post-nya.
 *
 * Kunci ini dipakai mencocokkan item dataset Apify kembali ke jadwal:
 * - TikTok: id video numerik dari `/video/<id>` atau `/photo/<id>`.
 * - Instagram: shortcode dari `/p/<code>`, `/reel/<code>`, `/reels/<code>`, `/tv/<code>`.
 *
 * Link pendek (vt.tiktok.com, instagr.am) ditolak: tanpa membuka link, kunci
 * post tidak bisa dibaca sehingga metriknya tidak bisa dicocokkan.
 */

export type ParsedPostUrl = {
  platform: "INSTAGRAM" | "TIKTOK";
  key: string;
  /** URL kanonik yang dikirim ke scraper. */
  url: string;
};

export function parsePostUrl(input: string): ParsedPostUrl {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new Error("Link post tidak valid — tempel link lengkap (https://…).");
  }
  const host = url.hostname.toLowerCase().replace(/^www\.|^m\./, "");
  const parts = url.pathname.split("/").filter(Boolean);

  if (host === "tiktok.com") {
    const i = parts.findIndex((p) => p === "video" || p === "photo");
    const id = i >= 0 ? parts[i + 1] : undefined;
    if (!id || !/^\d{8,25}$/.test(id)) {
      throw new Error(
        "Link TikTok harus link video lengkap, mis. https://www.tiktok.com/@username/video/123…",
      );
    }
    const handle = parts.find((p) => p.startsWith("@")) ?? "@_";
    return {
      platform: "TIKTOK",
      key: id,
      url: `https://www.tiktok.com/${handle}/${parts[i]}/${id}`,
    };
  }

  if (host === "instagram.com") {
    const i = parts.findIndex((p) => ["p", "reel", "reels", "tv"].includes(p));
    const code = i >= 0 ? parts[i + 1] : undefined;
    if (!code || !/^[A-Za-z0-9_-]{5,40}$/.test(code)) {
      throw new Error(
        "Link Instagram harus link post/reel, mis. https://www.instagram.com/reel/ABC123/",
      );
    }
    const kind = parts[i] === "reels" ? "reel" : parts[i];
    return { platform: "INSTAGRAM", key: code, url: `https://www.instagram.com/${kind}/${code}/` };
  }

  if (host.endsWith("tiktok.com") || host === "instagr.am") {
    throw new Error(
      "Link pendek belum didukung — buka link-nya dulu lalu salin URL lengkap dari browser.",
    );
  }
  throw new Error("Link post harus dari Instagram atau TikTok.");
}

/** Versi tanpa lempar galat — null bila link tidak dikenali. */
export function tryParsePostUrl(input: string | null | undefined): ParsedPostUrl | null {
  if (!input) return null;
  try {
    return parsePostUrl(input);
  } catch {
    return null;
  }
}
