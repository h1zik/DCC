/**
 * Komentar & lampiran TIDAK lagi dimuat di SSR daftar tugas. Dengan 200 tugas
 * × 80 komentar × 50 lampiran, query lama bisa membawa ratusan ribu baris
 * yang tidak pernah ditampilkan sampai user membuka detail.
 *
 * Sekarang `task-detail-sheet.tsx` melakukan lazy-load via
 * `loadTaskDetail()` saat sheet dibuka — payload SSR turun drastis dan badge
 * ringan tetap bisa pakai `_count` di masa depan jika diperlukan.
 *
 * Konstanta lama disimpan agar kode lain yang mungkin merefer tidak rusak,
 * tapi nilainya jadi 0 (tidak dipakai oleh include manapun).
 *
 * @deprecated Tidak lagi dipakai. Hapus saat tidak ada referensi tersisa.
 */
export const TASK_LIST_COMMENTS_TAKE = 0;
/** @deprecated Lihat catatan di atas. */
export const TASK_LIST_ATTACHMENTS_TAKE = 0;
