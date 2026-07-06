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
    id: "2026-07-06-finance-journal-counter",
    date: "2026-07-06",
    title: "Finance — penomoran jurnal tahan posting bersamaan",
    category: "fixed",
    description:
      "Nomor jurnal kini diambil dari counter khusus yang terkunci per transaksi, sehingga dua posting yang berlangsung bersamaan tidak lagi bisa berebut nomor yang sama (yang dulu membuat salah satunya gagal dengan pesan error teknis).",
  },
  {
    id: "2026-07-06-finance-db-constraints",
    date: "2026-07-06",
    title: "Finance — pagar pengaman di level database",
    category: "improved",
    description:
      "Database kini ikut menolak data pembukuan yang tidak sah (nominal negatif/rusak, baris debit-kredit ganda) meskipun ada bug aplikasi di masa depan, dan riwayat pembayaran tidak lagi bisa ikut terhapus saat dokumen induknya dihapus.",
  },
  {
    id: "2026-07-06-ai-api-fail-closed-role",
    date: "2026-07-06",
    title: "API AI — akses data kini fail-closed",
    category: "improved",
    description:
      "Endpoint baca untuk integrasi AI (/api/ai/*) tidak lagi diam-diam memakai hak akses tertinggi (CEO) saat role integrasi belum dikonfigurasi. Kini konfigurasi role wajib diset eksplisit; tanpa itu semua request ditolak, sehingga token yang bocor tidak otomatis bisa membaca data finance.",
  },
  {
    id: "2026-07-06-finance-subledger-consistency",
    date: "2026-07-06",
    title: "Finance — angka dashboard, neraca, dan hutang/piutang kini satu sumber",
    category: "fixed",
    description:
      "Tiga penyebab selisih angka ditutup: tagihan/invoice baru kini otomatis dijurnal ke akun kontrol (bukan hanya masuk daftar), saldo awal rekening bank baru otomatis dijurnal ke ledger, dan membalik jurnal kini ikut membereskan hutang/piutang terkait (pembayaran ditarik, dokumen hasil jurnal di-void, pengajuan dana kembali berstatus disetujui).",
    highlights: [
      "Form tagihan AP & invoice AR punya pilihan akun beban/pendapatan dan langsung menjurnal",
      "Saldo kas & bank di dashboard kini dihitung dari sumber yang sama dengan neraca",
      "Jurnal pembalik menyinkronkan status bill/invoice/pengajuan dana secara otomatis",
    ],
  },
  {
    id: "2026-07-06-finance-audit-trail",
    date: "2026-07-06",
    title: "Finance — jejak audit untuk aksi sensitif",
    category: "new",
    description:
      "Aksi finance yang sensitif kini tercatat permanen: siapa memposting/membalik jurnal, siapa membuka kunci periode tutup buku (beserta jejak kunci aslinya), siapa menghapus draf/kurs, dan siapa menjalankan reset data. Jejak ini tidak ikut terhapus oleh reset data demo.",
    highlights: [
      "Kolom baru \"diposting oleh\" pada jurnal — pembuat draf dan pem-posting kini dibedakan",
      "Buka kunci periode meninggalkan catatan audit permanen",
      "Mengunci periode yang sudah terkunci tidak lagi menimpa jejak pengunci asli",
    ],
  },
  {
    id: "2026-07-06-finance-atomic-payments",
    date: "2026-07-06",
    title: "Finance — pembayaran & pembalikan jurnal kini atomik (anti klik ganda)",
    category: "fixed",
    description:
      "Pembayaran hutang/piutang, pencairan pengajuan dana, posting, dan pembalikan jurnal kini berjalan sebagai satu transaksi database dengan penguncian yang benar. Klik ganda atau dua pengguna yang menekan tombol bersamaan tidak bisa lagi menghasilkan pembayaran dobel, dan kegagalan di tengah proses tidak meninggalkan pembukuan setengah jadi.",
    highlights: [
      "Pembayaran AP/AR: kunci baris + cek sisa + jurnal + status dalam satu transaksi",
      "Pencairan pengajuan dana memakai klaim compare-and-set sebelum jurnal dibuat",
      "Satu jurnal maksimal satu pembalik — kini ditahan juga di level database (unique constraint)",
    ],
  },
  {
    id: "2026-07-06-db-versioned-migrations",
    date: "2026-07-06",
    title: "Database — riwayat migrasi resmi menggantikan sinkronisasi langsung",
    category: "improved",
    description:
      "Perubahan struktur database kini melewati file migrasi ber-versi yang di-review di PR sebelum diterapkan (prisma migrate), menggantikan sinkronisasi schema langsung (db push). Setiap perubahan punya jejak, bisa diaudit, dan urutan deploy aman terdokumentasi di checklist baru.",
    highlights: [
      "Baseline migrasi 0_init dibuat dari schema saat ini — tanpa mengubah data",
      "db:deploy kini = prisma migrate deploy (hanya menjalankan migrasi yang sudah di-commit)",
      "Checklist deploy produksi baru: docs/audit/DEPLOY-CHECKLIST.md",
    ],
  },
  {
    id: "2026-07-06-finance-posted-line-lock",
    date: "2026-07-06",
    title: "Finance — jurnal terposting kini benar-benar tidak bisa diubah",
    category: "fixed",
    description:
      "Menutup celah teknis yang memungkinkan baris milik jurnal yang sudah diposting ikut terubah saat mengedit draf jurnal lain. Kini setiap perubahan baris diverifikasi benar-benar milik draf yang sedang diedit.",
  },
  {
    id: "2026-07-06-finance-money-validation",
    date: "2026-07-06",
    title: "Finance — validasi nominal lebih ketat & import CSV bank lebih akurat",
    category: "fixed",
    description:
      "Semua input nominal di modul Finance kini menolak nilai tidak valid (NaN, tak-hingga, negatif di tempat yang tidak semestinya) sebelum tersimpan, sehingga tagihan/pembayaran dengan angka rusak tidak bisa lagi menembus pembukuan. Import CSV rekening koran juga kini membaca format angka Amerika (1234.56) dengan benar.",
    highlights: [
      "Tagihan, invoice, pembayaran, pengajuan dana, budget, dan aset menolak nominal non-angka atau bertanda salah",
      "Baris jurnal menolak nominal negatif",
      "Nominal CSV bank format US tidak lagi terbaca 100× lipat; ukuran CSV dibatasi ±2 MB",
    ],
  },
  {
    id: "2026-07-06-finance-demo-reset-guard",
    date: "2026-07-06",
    title: "Finance — tombol reset data kini aman dari salah klik",
    category: "fixed",
    description:
      "Tombol \"Bersihkan\" di dashboard Finance (penghapus seluruh data finance untuk kebutuhan demo) kini dinonaktifkan otomatis di lingkungan produksi, meminta konfirmasi ketik-ulang, dan menolak berjalan selama masih ada periode pembukuan yang terkunci.",
    highlights: [
      "Di produksi tombol tersembunyi & server menolak reset kecuali diaktifkan eksplisit oleh admin (FINANCE_DEMO_RESET=true)",
      "Wajib mengetik frasa konfirmasi sebelum reset berjalan",
      "Reset ditolak selama ada periode pembukuan terkunci",
    ],
  },
  {
    id: "2026-07-06-db-deploy-safety",
    date: "2026-07-06",
    title: "Keamanan data — update aplikasi kini anti hilang data",
    category: "improved",
    description:
      "Proses update database saat deploy dirombak agar data operasional tim tidak mungkin terhapus diam-diam. Perubahan schema yang berisiko kini otomatis ditolak dan harus ditinjau manual, plus tersedia perintah backup & pratinjau perubahan sebelum deploy.",
    highlights: [
      "Deploy menolak perubahan database yang bisa menghapus data (flag --accept-data-loss dihapus dari semua script)",
      "Perintah baru db:backup (backup penuh via pg_dump) dan db:diff (pratinjau SQL sebelum diterapkan)",
      "Script penghapus data (mis. db:clear-projects) diblokir terhadap database production kecuali dipaksa secara eksplisit",
    ],
  },
  {
    id: "2026-07-04-agent-company-brain",
    date: "2026-07-04",
    title: "AI Agent — kini tahu kondisi seluruh perusahaan",
    category: "improved",
    description:
      "AI Agent di panel chat kini bisa membaca kondisi perusahaan lintas modul — briefing eksekutif, finance, pipeline, jadwal, absensi, wiki & dokumen — sesuai hak akses masing-masing peran. Jawaban juga lebih rapi (tabel & link kini tampil benar) dan penghapusan tugas lebih aman.",
    highlights: [
      "31 kemampuan baca baru: briefing eksekutif, risiko perusahaan, finance (ringkasan/AP-AR/budget), pipeline & proyek macet, workload tim, tugas user lain, jadwal, absensi, wiki, dokumen, approvals pending",
      "Otak agent dinaikkan ke Gemini 2.5 Flash (sebelumnya Flash Lite)",
      "Hapus tugas kini dijaga server: agent wajib menunjukkan preview dan menunggu jawaban \"ya\" eksplisit — tidak bisa langsung menghapus",
      "Operasi massal melaporkan tugas yang gagal, bukan hanya yang sukses",
      "Balasan chat mendukung tabel, link, dan format markdown penuh",
    ],
  },
  {
    id: "2026-07-04-research-hub-trust-overhaul",
    date: "2026-07-04",
    title: "Research Hub — data lebih jujur & bisa ditelusuri",
    category: "improved",
    description:
      "Perombakan besar keandalan Research Hub: setiap angka kini bisa ditelusuri ke sumbernya, data demo tidak pernah lagi menyamar sebagai data asli, dan output AI yang gagal ditampilkan apa adanya. Hasil riset kini lebih aman dipakai untuk keputusan pengembangan produk.",
    highlights: [
      "Sumber data (VPS/Apify/CSV/Demo) tercatat saat scrape — data demo diberi banner merah dan diblokir di produksi",
      "Concept Lab tidak lagi mengarang estimasi biaya produksi (COGS) — kini input manual/quote manufaktur",
      "Rekomendasi bisa ditolak/ditandai selesai; riwayatnya tidak lagi terhapus saat analisis ulang",
      "Konsep yang dikirim ke R&D membawa faktor risiko + sumber datanya, dan tertaut ke project-nya",
      "Laporan riset diberi versi — regenerate mengarsip versi lama, tidak menimpa",
      "Verdict GO/WATCH/AVOID dibatasi kecukupan data, bukan sekadar keyakinan AI",
      "Peringatan di dashboard bila refresh terjadwal (cron) tidak berjalan",
      "Thumbs up/down pada output AI + eval kualitas prompt (npm run eval:research)",
      "Model AI bisa diatur per tier — flash & pro kini DeepSeek V4 via Ollama Cloud",
    ],
  },
  {
    id: "2026-07-03-self-service-password-change",
    date: "2026-07-03",
    title: "Ganti kata sandi sendiri dari halaman profil",
    category: "new",
    description:
      "Sekarang kamu bisa mengganti kata sandi akunmu sendiri lewat Profil → Edit, tanpa perlu minta bantuan admin. Cukup masukkan kata sandi lama, lalu kata sandi baru minimal 8 karakter.",
    highlights: [
      "Kartu 'Ganti kata sandi' baru di halaman edit profil",
      "Kata sandi lama diverifikasi dulu sebelum diganti",
      "Reset oleh admin di halaman Admin → Users tetap tersedia",
    ],
  },
  {
    id: "2026-07-02-documents-redesign",
    date: "2026-07-02",
    title: "Documents ruangan — tampilan baru yang lebih rapi",
    category: "improved",
    description:
      "Halaman Documents di tiap ruangan didesain ulang agar lebih bersih dan mudah dipakai. Semua kontrol kini jadi satu bar, unggah bisa langsung tarik-lepas file ke mana saja, dan folder dipisah rapi dari file. Semua fitur lama tetap ada.",
    highlights: [
      "Atur ukuran kartu (Besar/Sedang/Kecil) hingga 8 kolom — pilihan tersimpan",
      "Folder tampil terpisah di atas, dengan tombol 'Lihat semua' bila banyak",
      "Kartu file lebih ringkas; tombol unduh/pindah/hapus muncul saat diarahkan",
      "Tarik & lepas file ke mana saja di area untuk mengunggah",
    ],
  },
  {
    id: "2026-07-02-security-hardening",
    date: "2026-07-02",
    title: "Keamanan aplikasi diperkuat",
    category: "improved",
    description:
      "Serangkaian penguatan keamanan menyeluruh untuk melindungi data perusahaan: akun & login lebih aman, akses data oleh AI Assistant dibatasi sesuai peran, dan berbagai celah teknis ditutup. Tidak ada perubahan pada cara kamu memakai aplikasi.",
    highlights: [
      "Perlindungan login dari percobaan tebak-password berulang",
      "Akses data AI Assistant dikunci sesuai peran (tidak bisa dinaikkan sembarangan)",
      "Header keamanan & batas unggahan diperketat",
    ],
  },
  {
    id: "2026-07-02-mcp-streamable-http",
    date: "2026-07-02",
    title: "AI Assistant — koneksi lewat HTTP (Streamable HTTP)",
    category: "improved",
    description:
      "Jembatan MCP yang menghubungkan AI Assistant ke data DCC kini disajikan lewat Streamable HTTP, bukan lagi proses lokal. Artinya bisa di-host jarak jauh (mis. Railway) dan diakses banyak klien AI sekaligus, dengan pengaman token.",
    highlights: [
      "Transport HTTP dengan manajemen sesi (endpoint /mcp)",
      "Proteksi bearer token opsional (MCP_HTTP_AUTH_TOKEN)",
      "Semua 69 tool read-only DCC tetap tersedia",
    ],
  },
  {
    id: "2026-06-30-attendance-checkin-guard",
    date: "2026-06-30",
    title: "Absensi — cegah salah input check-in/check-out",
    category: "fixed",
    description:
      "Tombol di menu Absensi kini bergantian: setelah check-in hanya tombol Check Out yang tampil, dan sebaliknya — supaya tidak ada lagi check-in dobel karena kepencet. Aturan urutan masuk/pulang juga divalidasi di server agar tetap aman walau dibuka di beberapa tab.",
    highlights: [
      "Tombol Check In otomatis disembunyikan setelah check-in",
      "Check-in lalu langsung check-out tetap bisa (tidak lagi ke-blok)",
      "Validasi urutan masuk/pulang di sisi server",
    ],
  },
  {
    id: "2026-06-29-competitor-shop-tracker-button",
    date: "2026-06-29",
    title: "Competitor Shop — tombol Tracker per produk",
    category: "new",
    description:
      "Di halaman detail Competitor Shop (tab SKU), tiap produk kini punya tombol \"Tracker\" untuk langsung menambahkannya ke Competitor — Products tracker, sama seperti di Product Discovery.",
    highlights: [
      "Tersedia di tampilan kartu maupun daftar",
      "Pilih kategori yang ada atau buat kategori baru",
      "Scraping berjalan di latar belakang",
    ],
  },
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
