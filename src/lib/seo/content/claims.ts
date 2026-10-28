/**
 * Klaim yang menunggu verifikasi manusia pada draft SEO.
 *
 * Penulis AI menyisipkan `<!-- verify: … -->` di HTML, tetapi komentar HTML
 * hilang saat TipTap menyerialisasi ulang konten. Karena itu daftar klaim
 * disimpan di `SeoContentDraft.aiMeta.pendingClaims` (kolom Json yang sudah
 * ada) dan HTML hanya dipakai sebagai sumber cadangan untuk draft lama.
 * Modul ini pure & bebas dependensi server agar bisa dipakai client.
 */

export const PENDING_CLAIMS_KEY = "pendingClaims";

const VERIFY_RE = /<!--\s*verify:\s*([\s\S]*?)-->/gi;

/** Ambil catatan dari semua marker `<!-- verify: … -->` di HTML. */
export function extractVerifyMarkersFromHtml(html: string): string[] {
  const out: string[] = [];
  const re = new RegExp(VERIFY_RE.source, "gi");
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    const note = match[1].trim();
    if (note) out.push(note);
  }
  return out;
}

/** Buang semua marker verify dari HTML (dipakai saat klaim sudah dipindah ke aiMeta). */
export function stripVerifyMarkers(html: string): string {
  return html.replace(new RegExp(VERIFY_RE.source, "gi"), "");
}

/** Baca `pendingClaims` dari aiMeta (toleran terhadap bentuk apa pun). */
export function readPendingClaims(aiMeta: unknown): string[] {
  if (!aiMeta || typeof aiMeta !== "object" || Array.isArray(aiMeta)) return [];
  const raw = (aiMeta as Record<string, unknown>)[PENDING_CLAIMS_KEY];
  if (!Array.isArray(raw)) return [];
  return raw
    .map((c) => (typeof c === "string" ? c.trim() : ""))
    .filter(Boolean);
}

/** Gabungkan daftar klaim tanpa duplikat (case/spasi-insensitive), urutan dipertahankan. */
export function unionClaims(...lists: string[][]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const list of lists) {
    for (const raw of list) {
      const claim = raw.trim();
      if (!claim) continue;
      const key = claim.toLowerCase().replace(/\s+/g, " ");
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(claim);
    }
  }
  return out;
}

/** Kembalikan aiMeta baru dengan `pendingClaims` diganti (field lain dipertahankan). */
export function withPendingClaims(
  aiMeta: unknown,
  claims: string[],
): Record<string, unknown> {
  const base =
    aiMeta && typeof aiMeta === "object" && !Array.isArray(aiMeta)
      ? { ...(aiMeta as Record<string, unknown>) }
      : {};
  base[PENDING_CLAIMS_KEY] = unionClaims(claims);
  return base;
}

/** Hapus satu klaim (pencocokan case/spasi-insensitive). */
export function removeClaim(claims: string[], claim: string): string[] {
  const key = claim.trim().toLowerCase().replace(/\s+/g, " ");
  return claims.filter(
    (c) => c.trim().toLowerCase().replace(/\s+/g, " ") !== key,
  );
}
