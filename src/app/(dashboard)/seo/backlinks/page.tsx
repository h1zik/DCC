import { redirect } from "next/navigation";

/**
 * Backlink Analysis DINONAKTIFKAN.
 *
 * Fitur ini butuh DataForSEO Backlinks API (subscription berbayar terpisah)
 * yang tidak tersedia, dan tidak ada sumber gratis setara untuk backlink gap
 * vs kompetitor. Kode logika (`src/lib/seo/backlinks/`, `src/actions/seo-backlinks.ts`),
 * model Prisma, dan tabel DB SENGAJA dipertahankan agar mudah diaktifkan lagi.
 *
 * Untuk mengaktifkan kembali (bila nanti punya akses Backlinks):
 * 1. Hapus redirect di file ini & `[profileId]/page.tsx` (kembalikan versi lama dari git).
 * 2. Kembalikan entri nav "backlinks" di `src/components/seo/seo-module-nav.ts`.
 * 3. Kembalikan kartu fitur + metrik di `src/app/(dashboard)/seo/page.tsx`
 *    dan section backlink di `src/lib/seo/reports/generator.ts`.
 */
export default function SeoBacklinksPage() {
  redirect("/seo");
}
