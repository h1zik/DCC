/**
 * Batas dan normalisasi kata kunci crawl — aman di-import dari komponen client.
 *
 * Dipisah dari `run-discovery.ts` (yang `server-only`) supaya dialog crawl bisa
 * memvalidasi sebelum mengirim: pengguna yang mengetik tujuh hashtag berhak
 * tahu saat itu juga, bukan lewat pesan error mentah dari server.
 */

/** Scraper di belakangnya memang hanya memproses lima hashtag per panggilan. */
export const MAX_DISCOVERY_TERMS = 5;

export const MAX_DISCOVERY_TERM_LENGTH = 80;

/**
 * Rapikan satu kata kunci jadi bentuk yang benar-benar dikirim ke scraper.
 *
 * Tanda `#` dibuang karena scraper TikTok/Instagram membuangnya sendiri, dan
 * huruf disamakan karena hashtag tidak peka huruf besar-kecil — tanpa ini
 * "#Skincare" dan "skincare" terhitung dua kata kunci yang memakan dua slot
 * untuk menyisir hashtag yang sama persis.
 */
export function normalizeDiscoveryTerm(raw: string): string {
  return raw
    .trim()
    .replace(/^#+/, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .slice(0, MAX_DISCOVERY_TERM_LENGTH);
}

/**
 * Pecah isian bebas (dipisah koma/baris baru) jadi daftar kata kunci bersih.
 * Urutan ketik dipertahankan; duplikat dibuang.
 */
export function parseDiscoveryTerms(raw: string): string[] {
  return dedupeDiscoveryTerms(raw.split(/[\n,]/).map(normalizeDiscoveryTerm));
}

export function dedupeDiscoveryTerms(terms: string[]): string[] {
  return [...new Set(terms.map(normalizeDiscoveryTerm).filter(Boolean))];
}
