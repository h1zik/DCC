/**
 * Changelog / Update Log DCC — sumber data tunggal.
 *
 * CARA MENAMBAH ENTRY (dibaca semua pengguna):
 *  1. Tambahkan objek baru di PALING ATAS array `CHANGELOG_ENTRIES`
 *     (urutan harus terbaru → terlama; UI & badge "baru" mengandalkan ini).
 *  2. `id` harus unik & stabil — gunakan pola `YYYY-MM-DD-slug`. Jangan
 *     pernah mengubah/menghapus `id` lama, karena dipakai untuk melacak
 *     entry mana yang sudah dilihat tiap pengguna (localStorage).
 *  3. Isi `date` dengan tanggal rilis (format `YYYY-MM-DD`).
 *  4. Pilih `category`: "new" | "improved" | "fixed".
 *  5. (Opsional) `roles` membatasi badge & relevansi ke peran tertentu;
 *     kosongkan untuk semua peran. (Opsional) `highlights` untuk poin ringkas.
 *
 * File ini ikut ter-deploy bersama commit fitur, jadi changelog otomatis
 * ter-update begitu perubahan di-push & di-deploy. Tidak perlu DB/admin UI.
 */

export type ChangelogCategory = "new" | "improved" | "fixed";

export interface ChangelogEntry {
  /** Unik & stabil. Pola: `YYYY-MM-DD-slug`. Jangan diubah setelah rilis. */
  id: string;
  /** Tanggal rilis `YYYY-MM-DD`. */
  date: string;
  /** Judul singkat fitur/perubahan. */
  title: string;
  category: ChangelogCategory;
  /** Penjelasan 1–3 kalimat untuk pengguna non-teknis. */
  description: string;
  /** Poin ringkas opsional. */
  highlights?: string[];
}

/**
 * Daftar perubahan — TERBARU DI ATAS.
 */
export const CHANGELOG_ENTRIES: ChangelogEntry[] = [
  {
    id: "2026-06-29-seo-toolkit",
    date: "2026-06-29",
    title: "SEO Toolkit — modul baru",
    category: "new",
    description:
      "Rangkaian alat SEO lengkap untuk pasar Indonesia (Google.co.id): riset keyword, pelacakan ranking, audit on-page, crawler teknis, optimasi konten, marketplace SEO, sampai laporan yang bisa diekspor.",
    highlights: [
      "Keyword research & clustering (volume, difficulty, CPC, intent)",
      "SERP rank tracker terjadwal dengan grafik tren",
      "On-page audit & technical crawler",
      "Content optimizer, marketplace SEO, dan SEO reports (PDF/DOCX)",
    ],
  },
  {
    id: "2026-06-29-content-studio-ideas",
    date: "2026-06-29",
    title: "Content Studio — Generator Ide Konten",
    category: "new",
    description:
      "Modul Content Studio kini punya generator ide konten yang grounded ke data brand & riset, lengkap dengan status alur kerja (draft → review → publish).",
    highlights: [
      "Buat set ide konten dari konteks brand",
      "Status badge untuk melacak progres tiap ide",
    ],
  },
  {
    id: "2026-06-29-brand-hub-audit",
    date: "2026-06-29",
    title: "Brand & Creative Hub — penyempurnaan",
    category: "improved",
    description:
      "Navigasi Brand Hub dirapikan, ditambah halaman detail iklan (ad library) dengan skor 'winning ad', serta catatan estimasi AI dan banner data demo agar sumber data lebih transparan.",
    highlights: [
      "Halaman detail iklan + skor winning ad",
      "Navigasi & sub-nav modul lebih ringkas",
      "Penanda estimasi AI dan data demo",
    ],
  },
  {
    id: "2026-06-28-shopee-scraper",
    date: "2026-06-28",
    title: "Research Hub — scraper Shopee diperbarui",
    category: "improved",
    description:
      "Pengambilan data produk Shopee diadaptasi agar lebih andal, dengan normalisasi metrik produk dan panel detail produk yang lebih informatif di Research Hub.",
  },
];

/** Entry terbaru (untuk perbandingan 'sudah dilihat'). `null` bila kosong. */
export const LATEST_CHANGELOG_ID: string | null =
  CHANGELOG_ENTRIES[0]?.id ?? null;

/**
 * Jumlah entry yang lebih baru dari `lastSeenId` (yaitu yang belum dilihat).
 * - `lastSeenId` null/tak dikenal → semua entry dianggap belum dilihat.
 * - `lastSeenId` == entry terbaru → 0.
 */
export function countUnseenEntries(lastSeenId: string | null): number {
  if (!lastSeenId) return CHANGELOG_ENTRIES.length;
  const idx = CHANGELOG_ENTRIES.findIndex((e) => e.id === lastSeenId);
  // Tidak ditemukan (mis. id lama sudah dihapus) → anggap semua belum dilihat.
  if (idx === -1) return CHANGELOG_ENTRIES.length;
  return idx;
}
