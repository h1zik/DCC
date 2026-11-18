/** Tautan eksternal sebagai lampiran (tugas, campaign). Murni, aman dipakai di klien. */

export const MAX_LINK_URL_CHARS = 2048;
export const MAX_LINK_TITLE_CHARS = 200;

/** Menerima "docs.google.com/..." tanpa skema; hanya http/https yang lolos. */
export function normalizeExternalUrl(raw: string): string {
  const t = raw.trim();
  if (!t) throw new Error("Masukkan tautan.");
  const withProto = /^https?:\/\//i.test(t) ? t : `https://${t}`;
  let u: URL;
  try {
    u = new URL(withProto);
  } catch {
    throw new Error("Format tautan tidak valid.");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new Error("Hanya tautan http atau https yang diizinkan.");
  }
  const s = u.toString();
  if (s.length > MAX_LINK_URL_CHARS) {
    throw new Error(
      `Tautan terlalu panjang (maks. ${MAX_LINK_URL_CHARS} karakter).`,
    );
  }
  return s;
}

export function defaultLinkTitle(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname === "/" ? "" : u.pathname;
    return (u.hostname + path).slice(0, MAX_LINK_TITLE_CHARS) || "Tautan";
  } catch {
    return "Tautan";
  }
}
