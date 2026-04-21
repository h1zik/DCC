/**
 * Batas relasi berat di halaman Kanban/list tugas — memperkecil payload RSC & query DB.
 * Komentar/lampiran terbaru dulu; setelah buka detail, `router.refresh()` mengisi data baru.
 */
export const TASK_LIST_COMMENTS_TAKE = 80;
export const TASK_LIST_ATTACHMENTS_TAKE = 50;
