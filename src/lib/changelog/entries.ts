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
    id: "2026-07-23-personal-notes-wiki-parity",
    date: "2026-07-23",
    title: "Catatan Pribadi: kini selengkap Wiki ruangan",
    category: "improved",
    description:
      "Catatan di Space Pribadi disamakan dengan Wiki ruangan versi terbaru. Tampilannya kini ala Notion — judul besar, baris properti kalem, konten di kolom tengah tanpa toolbar permanen (format lewat menu melayang dan perintah /) — plus Daftar Isi otomatis, riwayat versi dengan pulihkan, unduh ke berbagai format, dan bagian backlink. Fitur kolaborasi (komentar, presence, kunci edit) sengaja tidak dibawa karena catatan pribadi hanya milikmu.",
    highlights: [
      "Riwayat versi otomatis: setiap perubahan di-checkpoint berkala dan bisa dibandingkan lalu dipulihkan kapan saja",
      "Unduh catatan sebagai PDF, Word (DOCX), HTML, Markdown, atau teks biasa",
      "Daftar Isi otomatis dari heading, dan daftar backlink dari catatan lain yang menaut ke catatan yang sedang dibuka",
      "Draft lokal yang tertunda kini dikirim ulang otomatis begitu koneksi internet kembali",
    ],
  },
  {
    id: "2026-07-23-wiki-editor-notion-upgrade",
    date: "2026-07-23",
    title: "Wiki: editor rasa Notion — tabel lebih pintar, blok baru, dan PDF rapi",
    category: "new",
    description:
      "Editor wiki (juga Catatan Pribadi dan draft konten SEO) dirombak besar. Tabel kini punya kontrol ala Notion: arahkan kursor ke tabel untuk memunculkan grip baris/kolom berisi menu sisip, duplikat, gabung/pisah cell, sampai hapus baris/kolom — plus tombol + di tepi tabel dan garis bantu resize yang lebih mudah ditarik. Ada juga rata teks, warna & highlight, menu format melayang saat menyeleksi teks, blok Callout dan Toggle, geser-susun blok dengan handle ⠿, serta Daftar Isi otomatis. Export PDF diperbaiki total: bullet tidak lagi hilang, tabel dan gambar tampil sesuai editor, dan teks tidak terpotong di batas halaman.",
    highlights: [
      "Tampilan halaman ala Notion: judul besar, aksi halaman dirapikan ke ikon di pojok, tag & halaman induk jadi baris properti yang kalem, konten di kolom tengah — tanpa toolbar permanen; format lewat menu melayang saat seleksi dan perintah /",
      "Komentar kini terbuka sebagai panel geser di sisi kanan (bukan lagi menumpuk di bawah halaman), dibuka lewat tombol Komentar berlonceng jumlah di pojok kanan atas",
      "Tabel: hapus/sisip/duplikat baris & kolom lewat grip hover atau toolbar, gabung/pisah cell, toggle header, tombol + di tepi tabel",
      "Format baru: rata kiri/tengah/kanan/justify, warna teks & highlight, callout (info/tips/peringatan/bahaya), toggle list yang bisa dilipat",
      "Menu melayang muncul saat teks diseleksi; slash menu (/) kini berikon, berkelompok, dan hasilnya diurutkan sesuai relevansi",
      "Drag handle ⠿ untuk memindah blok, dan panel Daftar Isi otomatis dari heading di halaman wiki",
      "Export PDF: bullet point selalu tampil, tabel berbingkai rapi, gambar mengikuti perataan, dan halaman dipotong di antara blok — bukan di tengah kalimat",
    ],
  },
  {
    id: "2026-07-23-performance-overhaul",
    date: "2026-07-23",
    title: "Aplikasi lebih cepat dan ringan di seluruh halaman",
    category: "improved",
    description:
      "Perombakan performa menyeluruh: server tidak lagi mengulang pekerjaan yang sama di setiap klik, halaman kini hanya mengunduh komponen berat (chart, editor, panel suara, pratinjau PDF) saat benar-benar dipakai, dan unduhan file besar tidak lagi membebani memori server. Efeknya terasa sebagai pindah halaman yang lebih gesit dan halaman yang lebih cepat terbuka — tanpa ada fitur yang berubah cara pakainya.",
    highlights: [
      "Navigasi antar halaman lebih responsif — data sidebar dan pengaturan tampilan kini disimpan sementara (cache) dan diperbarui otomatis saat ada perubahan",
      "Buka halaman lebih ringan: pemutar suara, chart, editor teks, dan pratinjau PDF baru diunduh saat digunakan",
      "Unduh file atau folder besar (ZIP) kini mengalir langsung sehingga server tetap stabil walau beberapa orang mengunduh bersamaan",
      "Pencarian wiki/dokumen dan ringkasan keuangan lebih cepat berkat penataan index database",
      "Tab yang ditinggal di latar belakang berhenti membebani server dan otomatis menyegarkan diri saat dibuka kembali",
    ],
  },
  {
    id: "2026-07-22-voice-screenshare-layout",
    date: "2026-07-22",
    title: "Voice channel: tampilan saat share screen tidak lagi terpotong",
    category: "fixed",
    description:
      "Saat ada yang share screen dan peserta voice banyak, kartu peserta di sisi kiri memanjang keluar layar tanpa bisa digulir, dan tampilan share screen ikut terpotong bagian bawahnya. Sekarang daftar peserta bisa digulir dan share screen selalu tampil utuh. Bonus: bila lebih dari satu orang share screen, Anda bisa memilih tontonan dengan mengeklik kartunya.",
    highlights: [
      "Daftar peserta di samping share screen kini bisa digulir bila tidak muat",
      "Share screen tampil utuh, tidak lagi terpotong bar kontrol di bawah",
      "Share screen terbaru otomatis tampil besar; klik kartu peserta lain untuk menjadikannya tampilan utama",
      "Klik tampilan besar untuk kembali ke pilihan otomatis",
    ],
  },
  {
    id: "2026-07-22-upload-creative-file-formats",
    date: "2026-07-22",
    title: "Unggah: dukung file desain (AI, PSD, Premiere, After Effects, Blender, dll.)",
    category: "improved",
    description:
      "Sesuai masukan tim kreatif, unggahan kini menerima berkas sumber desain — Adobe Illustrator (.ai), Photoshop (.psd/.psb), Premiere Pro (.prproj), After Effects (.aep), Blender (.blend), serta banyak format 3D, video, audio, dan alat desain lain. Sebelumnya sebagian format ini bisa ditolak “Tipe file tidak diizinkan” tergantung komputer, dan di kolom chat malah tak bisa dipilih di jendela file. Berlaku di Documents, File Pribadi, lampiran tugas, dan chat.",
    highlights: [
      "Adobe: .ai, .eps, .psd, .psb, .indd, .idml, .xd, .prproj, .aep, .aepx",
      "3D & motion: .blend, .c4d, .fbx, .obj, .ma/.mb, .max, .stl, .glb/.gltf",
      "Alat desain lain: Figma, Sketch, Affinity, CorelDRAW, Procreate, Krita, GIMP",
      "Format dikenali dari ekstensi file sehingga tak lagi tergantung tebakan tipe oleh browser",
    ],
  },
  {
    id: "2026-07-22-documents-bulk-download-folders",
    date: "2026-07-22",
    title: "Documents: tombol Unduh kini aktif saat memilih folder",
    category: "fixed",
    description:
      "Saat memilih satu atau beberapa folder (atau campuran folder dan file), tombol Unduh di bar aksi mati dan tak bisa ditekan — unduhan massal dulu hanya mendukung file. Sekarang folder, file, maupun campuran keduanya bisa diunduh sekaligus sebagai satu berkas ZIP; isi tiap folder tersusun rapi di bawah nama foldernya.",
    highlights: [
      "Pilih beberapa folder lalu Unduh kini menghasilkan satu ZIP berisi semua folder beserta isinya",
      "Bisa mencampur folder dan file dalam satu kali unduh",
    ],
  },
  {
    id: "2026-07-22-documents-drag-move-not-upload",
    date: "2026-07-22",
    title: "Documents: menyeret file untuk memindahkan tidak lagi dikira unggah",
    category: "fixed",
    description:
      "Saat menyeret file di dalam folder untuk memindahkannya ke folder lain, aplikasi kadang salah mengira Anda sedang mengunggah dari komputer — panel “Lepas untuk mengunggah” muncul dan saat dilepas file malah terunggah ulang. Penyebabnya: menyeret dari thumbnail gambar memicu seret gambar bawaan browser. Sekarang seret selalu diperlakukan sebagai pemindahan item.",
    highlights: [
      "Menyeret file lewat gambar pratinjaunya kini memindahkan, bukan mengunggah ulang",
      "Panel unggah hanya muncul untuk file yang benar-benar diseret dari komputer",
    ],
  },
  {
    id: "2026-07-21-documents-drag-drop-visual-fix",
    date: "2026-07-21",
    title: "Documents: tampilan seret-lepas file/folder tidak lagi berantakan",
    category: "fixed",
    description:
      "Saat menyeret file atau folder untuk dipindahkan, yang ikut tertarik terlihat seperti potongan besar halaman, bukan item yang Anda seret. Sekarang muncul label kecil berisi ikon dan nama item yang sedang diseret, dan folder tujuan tersorot saat item melayang di atasnya sehingga jelas ke mana item akan jatuh.",
    highlights: [
      "Label seret menampilkan nama item; bila memilih beberapa item sekaligus, jumlah sisanya ditandai +N",
      "Folder tujuan tersorot saat item berada di atasnya, baik di tampilan grid maupun daftar",
      "Menyeret file dari komputer ke area Documents kembali memunculkan panel unggah walau melewati kartu folder",
    ],
  },
  {
    id: "2026-07-21-documents-pindah-folder-fix",
    date: "2026-07-21",
    title: "Documents: memindahkan folder lewat tombol Pindahkan tidak lagi ditolak",
    category: "fixed",
    description:
      "Saat memilih satu atau beberapa folder lalu menekan tombol Pindahkan, aplikasi selalu menolak dengan pesan “Anda tidak dapat memindahkan satu atau lebih file terpilih”, padahal folder tersebut memang milik Anda. Pengecekan izinnya keliru karena hanya menghitung file terpilih dan mengabaikan folder. Sekarang folder, file, maupun campuran keduanya bisa dipindahkan seperti biasa.",
    highlights: [
      "Pilih folder saja lalu Pindahkan kini berfungsi — isi folder ikut berpindah otomatis",
      "Tombol Pindahkan hanya muncul bila semua item terpilih memang boleh Anda pindahkan",
    ],
  },
  {
    id: "2026-07-21-content-plan-jam-posting",
    date: "2026-07-21",
    title: "Content Planning: jam posting dan saran jam efektif dari AI",
    category: "new",
    description:
      "Setiap konten kini bisa diberi jam posting, bukan cuma tanggal — penting saat ada lebih dari satu postingan di hari yang sama supaya pembagiannya efektif. Tombol Saran Jam AI menganalisis seluruh konten terjadwal dan mengusulkan jam yang efektif untuk audiens Indonesia, lengkap dengan alasannya, dan Anda tinggal memilih mana yang ingin diterapkan.",
    highlights: [
      "Kolom Posting menampilkan tanggal beserta jam, dan urutan tabel mengikuti jam dalam hari yang sama",
      "Penanda otomatis pada hari yang berisi lebih dari satu konten — berwarna kuning bila masih ada jam yang kosong atau bentrok",
      "Saran Jam AI menyebar konten di hari yang sama minimal berjarak tiga jam dan mempertahankan jam yang sudah Anda isi kecuali bentrok",
      "Hasil saran ditampilkan per tanggal dengan alasan singkat; centang yang ingin dipakai lalu terapkan sekaligus",
      "Jam posting ikut tampil di kartu content planning halaman Untuk Saya",
    ],
  },
  {
    id: "2026-07-21-content-plan-fixes",
    date: "2026-07-21",
    title: "Content Planning: video Reels bisa diunggah, slide carousel tidak lagi hilang diam-diam",
    category: "fixed",
    description:
      "Beberapa perbaikan penting di halaman Content Planning: file video kini muncul saat memilih file design untuk Reels dan Single Feed, mengubah jenis konten dari Carousel meminta konfirmasi lebih dulu karena slide selain yang pertama akan dihapus permanen, dan dua baris dengan nama konten sama tidak lagi ada yang terlewat saat ditambahkan ke Kanban.",
    highlights: [
      "Pemilih file design untuk Reels dan Single Feed kini menampilkan file video — sebelumnya hanya gambar dan dokumen",
      "Konfirmasi sebelum mengubah jenis dari Carousel bila ada lebih dari satu slide, karena slide sisanya dihapus permanen",
      "Tanggal tidak lagi bergeser satu hari antara tampilan tabel dan form edit",
      "Tambahkan ke Kanban tidak lagi melewati baris kedua yang judul kontennya kebetulan sama",
    ],
  },
  {
    id: "2026-07-21-room-documents-drive",
    date: "2026-07-21",
    title: "Documents: riwayat versi, berbagi tautan, sampah, dan favorit ala Google Drive",
    category: "new",
    description:
      "Documents di setiap Room naik kelas menjadi penyimpanan tim yang lengkap. File kini punya riwayat versi, bisa dibagikan ke anggota tertentu atau lewat tautan publik, dan file yang dihapus masuk ke Sampah dulu sehingga masih bisa dipulihkan. Sidebar baru menyediakan tampilan Semua file, Favorit, Terbaru, dan Sampah beserta ringkasan penyimpanan.",
    highlights: [
      "Riwayat versi: unggah versi baru dengan catatan, unduh versi lama, atau pulihkan versi lama tanpa kehilangan riwayat",
      "Sampah: hapus tidak langsung permanen — ada tombol Urungkan, bisa dipulihkan, dan baru benar-benar terhapus saat Hapus permanen",
      "Berbagi: beri anggota ruangan akses Viewer atau Editor, atau buat tautan publik hanya-baca yang bisa dibuka tanpa login (folder terunduh sebagai ZIP)",
      "Favorit dan tampilan Terbaru untuk menemukan kembali file yang sering dipakai",
      "Riwayat aktivitas: siapa mengunggah, mengganti nama, memindahkan, membagikan, atau menghapus apa dan kapan",
    ],
  },
  {
    id: "2026-07-21-room-documents-search-move",
    date: "2026-07-21",
    title: "Documents: pencarian sampai ke isi file, filter lengkap, dan pindah folder",
    category: "improved",
    description:
      "Mencari dan merapikan dokumen jadi jauh lebih cepat. Pencarian kini menjangkau teks di dalam dokumen, bukan hanya nama file dan tag, dan berlaku ke seluruh ruangan. Folder kini bisa dipindahkan beserta seluruh isinya, termasuk dengan menyeret item ke folder tujuan.",
    highlights: [
      "Cari berdasarkan kata di dalam dokumen, dengan filter tipe file, waktu unggah, pengunggah, dan tag",
      "Urutkan menurut nama, ukuran, tipe, pengunggah, atau waktu; pilih tampilan grid atau daftar dan ukuran kartu",
      "Pindahkan folder beserta isinya, pilih file dan folder sekaligus, atau seret ke folder tujuan di kartu, sidebar, maupun breadcrumb",
      "Anggota dengan akses Editor kini bisa mengganti nama, memindahkan, dan menghapus — tidak lagi khusus manager ruangan",
      "Daftar dimuat bertahap sehingga folder berisi ratusan file tetap ringan dibuka",
    ],
  },
  {
    id: "2026-07-19-voice-audio-settings",
    date: "2026-07-19",
    title: "Voice call: pengaturan suara — atur volume per orang dan pilih perangkat audio",
    category: "new",
    description:
      "Group call kini punya tombol Pengaturan suara di deret kontrol panggilan. Kecilkan atau senyapkan suara peserta tertentu tanpa memengaruhi yang lain, pilih mikrofon dan output suara yang dipakai, serta atur peredam bising, pembatalan gema, dan penguatan otomatis. Semua preferensi diingat untuk panggilan berikutnya di perangkat yang sama.",
    highlights: [
      "Volume per peserta 0–100% — peserta yang dikecilkan tetap dikecilkan di panggilan berikutnya",
      "Pilih perangkat mikrofon dan output suara langsung di tengah panggilan",
      "Toggle peredam bising, pembatalan gema, dan penguatan otomatis berlaku tanpa perlu keluar-masuk panggilan",
      "Mode tuli tetap menyenyapkan semua audio; saat dibuka, volume per peserta kembali seperti semula",
      "Tersedia di panel panggilan maupun jendela mini melayang",
    ],
  },
  {
    id: "2026-07-18-room-voice-channels",
    date: "2026-07-18",
    title: "Voice channel: group call ala Discord langsung di dalam Room",
    category: "new",
    description:
      "Setiap Room kini bisa memiliki voice channel untuk group call bersama tim — bicara lewat mikrofon, nyalakan kamera, dan share screen tanpa keluar dari DCC. Panggilan tetap tersambung saat berpindah halaman: jendela kecil melayang menampilkan video dan kontrol, dan bisa digeser ke posisi mana pun.",
    highlights: [
      "Buat channel bertipe Voice dari sidebar Team Chat (toggle # menjadi ikon suara)",
      "Kontrol lengkap: mute mic, kamera, share screen, mode tuli, dan keluar panggilan",
      "Sidebar menampilkan siapa saja yang sedang tersambung di tiap voice channel",
      "Panggilan tetap aktif di seluruh aplikasi — jendela mini melayang bisa digeser dan diperbesar kembali",
      "Tampilan panggilan mengikuti tema DCC, termasuk tema kustom dan mode terang/gelap",
    ],
  },
  {
    id: "2026-07-18-team-chat-polish",
    date: "2026-07-18",
    title: "Team Chat: navigasi riwayat dan indikator yang lebih nyaman",
    category: "improved",
    description:
      "Membaca riwayat chat kini lebih nyaman: tombol “Ke pesan terbaru” muncul saat menggulir ke atas dan berubah menjadi penanda jumlah pesan baru yang masuk. Indikator mengetik, tampilan channel kosong, dan penanda channel aktif juga diperhalus.",
    highlights: [
      "Tombol lompat ke pesan terbaru dengan hitungan pesan baru saat sedang membaca riwayat",
      "Indikator “sedang mengetik” dengan animasi titik dan nama pengirim yang jelas",
      "Channel yang sedang dibuka ditandai garis aksen di sisi kiri, ala Discord",
    ],
  },
  {
    id: "2026-07-17-attendance-multiple-sessions-details",
    date: "2026-07-17",
    title: "Absensi multi-sesi dan koreksi keterangan kini lebih akurat",
    category: "fixed",
    description:
      "Menu Absensi kini selalu menentukan Check In atau Check Out dari aktivitas terbaru, termasuk saat bekerja dalam beberapa sesi pada hari yang sama. Rencana kerja dan tugas selesai yang terlupa juga dapat ditambahkan atau diperbarui dari riwayat absensi hari ini tanpa mengubah waktu maupun status kehadiran.",
    highlights: [
      "Urutan Check In, Check Out, lalu Check In kembali kini menampilkan aksi Check Out yang benar",
      "Rencana kerja dan tugas selesai hari ini dapat ditambah, diubah, atau dikosongkan",
      "Status pengguna, rekap admin, dan ringkasan AI memakai sesi absensi terbaru secara konsisten",
      "Pergantian hari absensi mengikuti zona waktu Asia/Jakarta",
    ],
  },
  {
    id: "2026-07-16-changelog-page-redesign",
    date: "2026-07-16",
    title: "Changelog baru: lebih mudah mencari dan memindai pembaruan",
    category: "improved",
    description:
      "Halaman Apa yang Baru kini memiliki tampilan timeline yang lebih terstruktur, pencarian cepat, dan filter kategori. Setiap rilis juga menampilkan detail dengan hierarki yang lebih jelas agar perubahan penting lebih mudah ditemukan di desktop maupun perangkat mobile.",
    highlights: [
      "Cari pembaruan berdasarkan fitur, modul, deskripsi, atau poin penting",
      "Filter cepat untuk fitur baru, peningkatan, dan perbaikan",
      "Timeline dikelompokkan per tanggal dengan tampilan responsif dan ramah tema",
    ],
  },
  {
    id: "2026-07-16-gamification-admin-tabs",
    date: "2026-07-16",
    title: "Admin gamifikasi kini lebih ringkas dan mudah dinavigasi",
    category: "improved",
    description:
      "Halaman admin gamifikasi kini memisahkan ringkasan, background, frame avatar, dan achievement ke dalam tab khusus. Informasi katalog juga diringkas agar status item aktif dan visual custom lebih cepat dipantau.",
    highlights: [
      "Navigasi tab baru menjaga setiap katalog tetap fokus tanpa halaman yang terlalu panjang",
      "Ringkasan performa 28 hari dan master switch tampil lebih sederhana",
      "Kartu katalog mengutamakan nama, status unlock, dan media yang relevan",
    ],
  },
  {
    id: "2026-07-16-meta-ad-library-background-polling",
    date: "2026-07-16",
    title: "Meta Ad Library tidak lagi berhenti karena batas waktu request",
    category: "fixed",
    description:
      "Proses pengambilan iklan Meta kini berjalan bertahap di background dan dilanjutkan oleh polling Research Hub. Batch yang masih berjalan atau sempat terputus dapat dipulihkan otomatis tanpa salah ditandai gagal saat Apify belum selesai.",
    highlights: [
      "Request tidak lagi menunggu actor Apify hingga sepuluh menit",
      "Status sementara dan gangguan fetch singkat akan dicoba lagi pada polling berikutnya",
      "Cron Research Hub ikut melanjutkan batch Meta Ad Library yang tertunda",
    ],
  },
  {
    id: "2026-07-16-research-team-mcp",
    date: "2026-07-16",
    title: "Research Hub: akses AI khusus Team yang lebih aman",
    category: "new",
    description:
      "Team kini dapat memakai MCP khusus Research Hub untuk menganalisis kompetitor, harga, review, tren, keyword, konsep produk, dan laporan riset tanpa membuka akses ke data sensitif DCC lainnya. Koneksi ini memakai token dan endpoint terpisah yang dibatasi hanya untuk Research Hub.",
    highlights: [
      "25 tool Research Hub tersedia melalui koneksi MCP khusus Team",
      "Tidak menyediakan akses ke finance, tugas, pengguna, ruangan, dokumen, inventori, absensi, atau approval",
      "Token Research ditolak otomatis bila digunakan ke endpoint DCC di luar Research Hub",
    ],
  },
  {
    id: "2026-07-15-research-hub-marketplace-logos",
    date: "2026-07-15",
    title: "Research Hub: logo platform di semua tampilan marketplace",
    category: "improved",
    description:
      "Shopee, Tokopedia, Lazada, TikTok Shop, Female Daily, dan Sociolla kini tampil dengan logo berwarna khas masing-masing — bukan lagi sekadar teks — di seluruh Research Hub: pilihan marketplace saat membuat riset, kartu & tabel produk, dropdown, dan halaman detail.",
    highlights: [
      "Logo muncul di Product Discovery, Review Intelligence, Competitor Tracker, dan Keyword Intel",
      "Riset multi-marketplace menampilkan deretan logo ringkas (nama muncul saat disorot)",
      "Komponen tabel & kartu produk yang sama juga dipakai Brand Hub, jadi logonya ikut konsisten di sana",
    ],
  },
  {
    id: "2026-07-15-seo-crawler-page-inventory",
    date: "2026-07-15",
    title: "SEO Crawler: inventaris semua halaman + hasil crawl tanpa menunggu cron",
    category: "improved",
    description:
      "Halaman detail crawl kini menyimpan dan menampilkan SEMUA halaman yang ditemukan — bukan hanya yang bermasalah — lengkap dengan status HTTP, skor on-page, metadata, jumlah link internal/eksternal, kedalaman klik, dan waktu muat. Selain itu, selama halaman crawler terbuka hasil crawl diambil otomatis begitu selesai; cron kini hanya cadangan.",
    highlights: [
      "Tab inventaris halaman baru di detail crawl: filter status (2xx/3xx/4xx/5xx), pencarian URL/judul, dan kolom skor on-page",
      "Halaman sehat ikut tersimpan sehingga cakupan crawl bisa diaudit, bukan cuma daftar masalah",
      "Crawl yang sedang berjalan dipantau langsung dari halaman (polling) — selesai lebih cepat tanpa menunggu jadwal cron",
    ],
  },
  {
    id: "2026-07-15-seo-keyword-competition-fix",
    date: "2026-07-15",
    title: "Perbaikan skala angka kompetisi keyword dari DataForSEO Labs",
    category: "fixed",
    description:
      "Angka kompetisi keyword dari DataForSEO Labs ternyata sudah berskala 0–1 tetapi sempat dibagi 100 lagi, sehingga nilai kompetisi tampil jauh lebih kecil dari seharusnya. Perhitungan diperbaiki dan data lama dikoreksi otomatis lewat migrasi.",
  },
  {
    id: "2026-07-15-kanban-stage-picker-overdue-lane",
    date: "2026-07-15",
    title: "Kanban dirombak: pilih Tahap (kolom) langsung dari tugas, kolom Overdue kini otomatis dua arah",
    category: "improved",
    description:
      "Kolom papan Kanban kini menjadi \"Tahap\" tugas yang sesungguhnya. Saat mengubah tugas dari detail atau daftar, kamu memilih kolom papan (termasuk kolom custom seperti Revisi) — bukan lagi status generik — dan kartunya benar-benar pindah. Kolom Overdue tetap ada tapi kini dikelola sistem dua arah: tugas yang lewat deadline masuk otomatis, dan begitu deadline-nya diundur kartunya keluar sendiri kembali ke Berjalan (dulu nyangkut selamanya).",
    highlights: [
      "Dropdown Status di detail tugas & daftar diganti dropdown Tahap berisi kolom papan aktif — kolom custom akhirnya bisa dipilih",
      "Ubah tahap dari mana pun (detail, daftar, papan) kini selalu memindahkan kartu — tidak ada lagi tugas \"Selesai\" yang nyangkut di kolom To-Do",
      "Kolom Overdue jadi lajur otomatis: deadline lewat → kartu masuk; deadline diundur → kartu keluar sendiri (langsung saat disimpan, tanpa menunggu cron)",
      "Kartu telat diberi label merah \"Telat X hari\" agar terlihat berapa lama tertunggak",
      "Saat membuat kolom custom, pilih kolom itu \"dihitung sebagai\" Berjalan / Dalam review / Diblokir untuk pelaporan & progres proyek",
      "Perbaikan: pindah tugas ke kolom custom dari tampilan Daftar sebelumnya selalu gagal di fase bawaan",
    ],
  },
  {
    id: "2026-07-15-dominatus-lab-bento-studio",
    date: "2026-07-15",
    title: "Dominatus Lab v3: satu bahasa desain \"Bento Studio\" + sidebar bisa diciutkan",
    category: "improved",
    description:
      "Seluruh Dominatus Lab kini memakai bahasa visual yang sama — tile bento hangat, papan metrik, dan kartu kaya statistik — yang sebelumnya hanya ada di SEO Toolkit. Beranda Lab, Research Hub, Brand & Creative Hub, dan Content Studio dirombak halaman demi halaman mengikuti standar itu, dan sidebar navigasi utama sekarang bisa diciutkan jadi rail ikon untuk kerja yang lebih lega.",
    highlights: [
      "Skin \"Bento Studio\" (dulu eksklusif SEO Toolkit) kini jadi tampilan baku semua modul Lab, dengan warna aksen khas tiap modul (teal SEO, ungu Research, pink Brand, amber Content)",
      "70+ halaman didesain ulang: strip ringkasan statistik, form pembuatan yang bisa dilipat, kartu kaya mini-stat, dan tabel dengan pencarian & pengurutan",
      "Beranda Lab tampil sebagai papan bento dengan pintasan & statistik live per modul",
      "Sidebar kiri utama bisa diciutkan jadi rail ikon (tombol di footer atau Ctrl/Cmd+B) — pilihan tersimpan otomatis",
      "Latar animasi aurora lama dihapus demi tampilan yang lebih bersih dan cepat",
    ],
  },
  {
    id: "2026-07-14-dominatus-lab-v2",
    date: "2026-07-14",
    title: "Dominatus Lab v2: ruang kerja riset terpisah dengan wajah baru",
    category: "improved",
    description:
      "Dominatus Lab kini terasa seperti aplikasi tersendiri: masuk dari menu Lab akan berpindah ke shell khusus dengan sidebar dan header sendiri, tema laboratorium (gelap/terang terpisah dari tema DCC), serta latar aurora beranimasi. Seluruh halaman Brand & Creative Hub, Research Hub, SEO Toolkit, dan Content Studio didesain ulang mengikuti bahasa visual Lab — kartu kaca, aksen warna khas tiap modul, dan grafik yang mengikuti palet Lab.",
    highlights: [
      "Shell Dominatus Lab sendiri: sidebar modul, header bersih, dan tombol Kembali ke DCC",
      "Tema Lab mengambil alih seluruh tampilan selama di dalam Lab — termasuk dialog, dropdown, dan toast — lalu tema DCC dipulihkan saat keluar",
      "60+ halaman modul dimigrasikan ke komponen Lab baru dengan aksen per modul (pink, violet, cyan, amber)",
      "Semua chart kini mengikuti palet Lab (tooltip & axis ikut tema, warna hardcoded dibersihkan)",
      "URL tidak berubah — semua tautan dan bookmark lama tetap berfungsi",
    ],
  },
  {
    id: "2026-07-14-dominatus-lab",
    date: "2026-07-14",
    title: "Dominatus Lab: satu pintu untuk semua modul riset & kreatif",
    category: "new",
    description:
      "Brand & Creative Hub, Research Hub, SEO Toolkit, dan Content Studio kini diakses lewat satu halaman launcher baru bernama Dominatus Lab — menggantikan empat menu terpisah di sidebar. Halamannya dilengkapi statistik langsung dari tiap modul, pintasan ke tool populer, dan mode terang/gelap sendiri.",
    highlights: [
      "Sidebar Project Manager, Market Analyst, dan tim studio kini menampilkan satu menu Dominatus Lab",
      "Setiap modul tampil sebagai kartu dengan angka live (laporan riset, keyword terlacak, ide konten, dan lainnya)",
      "Modul di luar akses peran tetap terlihat namun terkunci — hak akses tidak berubah",
      "Toggle mode terang/gelap khusus halaman Lab, terpisah dari tema aplikasi",
    ],
  },
  {
    id: "2026-07-13-seo-ai-visibility-keyword-gap-fixes",
    date: "2026-07-13",
    title: "SEO: AI Visibility lebih stabil & Keyword Gap lebih akurat",
    category: "fixed",
    description:
      "AI Visibility kini memakai format model DataForSEO yang benar untuk Gemini dan menyediakan pilihan Claude. Mesin Keyword Gap juga diperbaiki agar membandingkan union keyword organik setiap domain, membaca Page Intersection terbaru, serta menjelaskan cakupan sampel secara transparan.",
    highlights: [
      "Gemini tidak lagi gagal karena field model_name dan Claude tersedia sebagai model AI Visibility",
      "Keyword Gap menghitung keyword organik target dan kompetitor secara utuh, maksimal 1.000 keyword teratas per domain",
      "Kategori Missing, Weak, Strong, Shared, Untapped, Unique, dan Mixed kini mengikuti posisi setiap domain dan dapat tumpang tindih",
      "Hasil dari mesin lama ditandai perlu Refresh sebelum digunakan kembali",
      "Page Intersection dan filter Keyword Gap di UI, API, serta MCP memakai kontrak data yang konsisten",
    ],
  },
  {
    id: "2026-07-13-seo-gsc-ai-visibility",
    date: "2026-07-13",
    title: "SEO: integrasi Search Console, Content Audit, AI Visibility & cek orisinalitas",
    category: "new",
    description:
      "SEO Toolkit kini terhubung ke data nyata Google Search Console: Content Audit menandai halaman yang trafiknya menurun (decay) dan bisa langsung dijadikan opportunity optimasi. Ada juga AI Visibility — cek apakah brand disebut ChatGPT/Gemini/Perplexity untuk keyword komersial — plus cek orisinalitas artikel AI, tren organik bulanan di Domain Overview, bedah halaman vs halaman kompetitor, dan grounding brief yang lebih tembus bot-wall.",
    highlights: [
      "Content Audit (GSC): klik 28 hari vs sebelumnya per halaman, deteksi decay → 1-klik ke feed Opportunities",
      "Kartu GSC di dashboard SEO: klik & impresi organik nyata + query teratas",
      "AI Visibility: mention rate brand di jawaban ChatGPT/Gemini/Perplexity per keyword",
      "Cek orisinalitas draft: kalimat sampel dicari sebagai frasa persis di Google",
      "Riset keyword lebih kaya: related keywords semantik ikut ditarik",
      "Domain Overview: tren trafik & keyword organik hingga 24 bulan",
      "Keyword Gap: bedah halaman vs halaman (URL vs URL kompetitor)",
    ],
  },
  {
    id: "2026-07-13-seo-toolkit-v2",
    date: "2026-07-13",
    title: "SEO Toolkit v2: mesin konten AI grounded SERP, Keyword Gap, Domain Overview & Rank Tracker kompetitor",
    category: "new",
    description:
      "Upgrade besar-besaran modul SEO. Brief artikel kini dibangun dari data SERP & halaman kompetitor nyata (istilah penting, People Also Ask, target panjang), AI menulis artikel 1500+ kata section-per-section dengan meta & saran internal link, dan skor konten dihitung real-time ala Surfer saat mengetik. Ada juga feed \"Content Opportunities\" (rekomendasi artikel dari riset keyword + posisi ranking), Keyword Gap vs kompetitor, Domain Overview, pelacakan posisi kompetitor + visibility score, audit teknis terjadwal dengan health score, dan ekspor artikel DOCX/Markdown/HTML siap pakai.",
    highlights: [
      "Brief grounded SERP: top-10 nyata, istilah kompetitor, People Also Ask, target kata",
      "Artikel AI 1500–2500 kata + meta title/description/slug + FAQ + ekspor DOCX/MD/HTML",
      "Skor konten real-time di editor (cakupan istilah, struktur, pertanyaan, meta, keterbacaan)",
      "Feed Content Opportunities: pipeline ide → brief → draft → terbit, 1-klik buat brief",
      "Keyword Gap (missing/weak/untapped) & Domain Overview ala Semrush",
      "Rank Tracker v2: posisi kompetitor, visibility score, share of voice, ringkasan mingguan",
      "Audit teknis terjadwal: health score, diff isu antar-crawl, deteksi keyword cannibalization",
    ],
  },
  {
    id: "2026-07-13-gamification-upload-personal-kanban-order",
    date: "2026-07-13",
    title: "Upload background gamifikasi lebih besar & kolom kanban pribadi bisa diurutkan",
    category: "improved",
    description:
      "Admin kini bisa mengunggah background animasi gamifikasi hingga 20 MB. Di Space Pribadi → Papan Tugas, urutan kolom juga bisa diubah langsung dengan drag-and-drop dan tetap tersimpan setelah halaman dimuat ulang.",
    highlights: [
      "Batas aset background animasi dinaikkan menjadi 20 MB",
      "Geser kolom Papan Tugas pribadi lewat pegangan di header kolom",
      "Urutan baru tersimpan otomatis dan tetap konsisten setelah refresh",
    ],
  },
  {
    id: "2026-07-12-personal-space",
    date: "2026-07-12",
    title: "Space Pribadi baru: catatan, kanban, bookmark & file — 100% privat",
    category: "new",
    description:
      "Menu baru \"Space Pribadi\" di sidebar bawah, tersedia untuk semua peran. Isinya murni milikmu sendiri: catatan rich-text bertingkat (folder), papan kanban pribadi, daftar bookmark, dan penyimpanan file dengan folder. Tidak ada admin, CEO, atau AI Assistant yang bisa membaca isinya — bahkan lewat panel admin sekalipun.",

    highlights: [
      "Catatan: editor rich-text (Tiptap) dengan struktur folder & autosave aman multi-tab",
      "Kanban pribadi: kolom & kartu bisa diatur bebas, terpisah total dari kanban proyek/room",
      "Bookmark: simpan tautan dengan judul, deskripsi, dan tag",
      "File pribadi: unggah & atur folder, diunduh hanya lewat endpoint ber-autentikasi milik sendiri",
      "Isolasi privasi dijaga di server (filter ownerId) — tidak pernah muncul di endpoint AI/MCP atau laporan apa pun",
    ],
  },
  {
    id: "2026-07-12-document-thumb-only-preview",
    date: "2026-07-12",
    title: "Documents — kartu & filmstrip tidak lagi memuat file mentah",
    category: "fixed",
    description:
      "Perbaikan kinerja: kartu grid, baris daftar, dan filmstrip pratinjau dokumen kini hanya menampilkan thumbnail WebP terkompres. File tanpa thumbnail jatuh ke ikon tipe file (bukan file asli yang bisa puluhan MB), yang sebelumnya bisa membuat folder tertentu macet total saat dimuat.",
  },
  {
    id: "2026-07-10-tasks-gantt-revamp",
    date: "2026-07-10",
    title: "Gantt Tasks dirombak: geser jadwal, filter, dan status berwarna",
    category: "improved",
    description:
      "Tampilan Gantt di menu Tasks kini jauh lebih interaktif. Kamu bisa menggeser bar tugas langsung di garis waktu untuk mengubah jadwal, melihat status (belum mulai/berjalan/selesai/telat) lewat warna, serta avatar penanggung jawab dan progres checklist di setiap baris. Ada panel daftar tugas yang bisa dilipat, filter status & proyek, dan tombol tambah tugas langsung dari Gantt.",
    highlights: [
      "Geser bar untuk reschedule tugas, lengkap dengan pembaruan langsung & rollback jika gagal",
      "Warna bar mengikuti status tugas, termasuk penanda telat",
      "Avatar penanggung jawab & progres checklist tampil di setiap baris",
      "Filter status/proyek, panel daftar yang bisa dilipat, dan tombol tambah tugas baru",
    ],
  },
  {
    id: "2026-07-10-theme-menu-and-header",
    date: "2026-07-10",
    title: "Menu tema baru di header + perbaikan warna tema custom",
    category: "improved",
    description:
      "Pemilihan tema (preset, tema custom tersimpan, dan mode terang/gelap) kini digabung jadi satu menu ringkas di header, menggantikan tombol toggle lama. Tombol-tombol header (notifikasi, chat langsung, panel agent, tema) sekarang duduk rapi dalam satu toolbar. Kami juga memperbaiki perhitungan kontras warna tema custom — sebelumnya beberapa pilihan warna aksen bisa membuat teks jadi kekuningan/kecokelatan; sekarang kontras dihitung dengan benar sesuai standar WCAG.",
    highlights: [
      "Satu menu tema di header untuk preset, tema custom, dan mode terang/gelap",
      "Toolbar header lebih rapi untuk notifikasi, chat, panel agent, dan tema",
      "Perbaikan bug: warna teks pada tema custom kini kontras dengan benar",
    ],
  },
  {
    id: "2026-07-10-brand-logo-upload",
    date: "2026-07-10",
    title: "Upload & crop logo brand langsung dari panel Brands",
    category: "improved",
    description:
      "Logo brand tidak lagi diisi lewat tautan URL — sekarang admin bisa mengunggah file gambar langsung dan mengatur posisi/zoom-nya lewat editor crop sebelum disimpan. File lama otomatis dibersihkan saat logo diganti atau brand dihapus.",
    highlights: [
      "Unggah file gambar untuk logo brand, lengkap editor crop & zoom",
      "Pratinjau langsung saat mengatur posisi logo",
      "File logo lama dibersihkan otomatis saat diganti/dihapus",
    ],
  },
  {
    id: "2026-07-09-cosmetic-catalog-admin",
    date: "2026-07-09",
    title: "Katalog kosmetik dikelola admin: background & frame animasi (Lottie)",
    category: "improved",
    description:
      "Semua background dan frame avatar kini berasal dari satu katalog yang dikelola admin lewat menu Gamifikasi — tim bisa menambah, mengedit, dan mengunci kosmetik (gratis atau di-unlock via achievement) langsung dari panel baru. Kosmetik kini mendukung media animasi Lottie selain gambar. Fitur 'unggah latar sendiri' di profil dilepas: pilihan latar jadi lebih rapi dan konsisten dari katalog kurasi.",
    highlights: [
      "Panel admin baru untuk mengelola background & frame avatar",
      "Dukungan aset animasi Lottie untuk kosmetik",
      "Slot 'unggah latar sendiri' dipensiunkan — semua latar dari katalog",
      "Pratinjau langsung saat admin menambah/mengedit kosmetik",
    ],
  },
  {
    id: "2026-07-08-profile-gamification",
    date: "2026-07-08",
    title: "Profil gamifikasi ala Steam: level, XP, achievement & kosmetik",
    category: "new",
    description:
      "Profilmu kini punya level & XP yang benar-benar berarti. Kumpulkan XP dari hal bernilai — check-in absensi terverifikasi tepat waktu (dengan streak beruntun), tugas selesai sebelum tenggat, dan menjaga data tetap segar — lalu buka achievement dan kosmetik. Hias profilmu di halaman Edit: background hidup, frame avatar beranimasi, nameplate, gelar, warna aksen, dan etalase pencapaian yang bisa diatur urutannya. Level lamamu tidak turun — dihitung sebagai lantai. Bisa dinyalakan/dimatikan admin lewat Pengaturan → Gamifikasi.",
    highlights: [
      "Level & XP dari outcome terverifikasi (absensi tepat waktu, task on-time, data segar) — anti-gaming",
      "Achievement + streak absensi, dengan notifikasi saat terbuka",
      "Kosmetik: background beranimasi, frame, nameplate, gelar, accent — sebagian gratis, sebagian di-unlock",
      "Editor 2-kolom dengan pratinjau langsung + galeri achievement",
      "Ikut tema aktif (tema terang/gelap/custom) & hormati preferensi 'reduce motion'",
    ],
  },
  {
    id: "2026-07-07-custom-theme-studio",
    date: "2026-07-07",
    title: "Racik & simpan tema aplikasimu sendiri",
    category: "new",
    description:
      "Selain tema jadi, kini kamu bisa meracik tema sendiri di Profil: pilih warna latar bebas (teks & kartu otomatis menyesuaikan agar tetap terbaca), warna aksen, tingkat kelengkungan sudut, serta font teks dan judul. Semua berubah dengan pratinjau langsung. Tema hasil racikan bisa kamu simpan, beri nama, dan jadi preset milikmu — buat sebanyak yang kamu mau, ganti-ganti kapan saja.",
    highlights: [
      "Warna latar & aksen bebas dengan penyesuaian kontras otomatis",
      "Atur kelengkungan sudut + pilih font teks & judul",
      "Simpan banyak tema bernama dan berpindah sesukamu",
    ],
  },
  {
    id: "2026-07-07-document-preview-revamp",
    date: "2026-07-07",
    title: "Pratinjau file didesain ulang: zoom, geser & navigasi lebih enak",
    category: "improved",
    description:
      "Jendela pratinjau dokumen dipoles jadi seperti galeri profesional: panggung gambar gelap yang fokus, tombol pindah-file di tepi, dan deretan thumbnail (filmstrip) untuk lompat antar-gambar. Sekarang gambar juga bisa di-zoom (tombol, scroll, atau klik-ganda) dan digeser saat diperbesar. Bar atasnya lebih ringkas dengan info file yang rapi, dan tag jadi chip berwarna sesuai status.",
  },
  {
    id: "2026-07-07-document-rename-toolbar",
    date: "2026-07-07",
    title: "Ganti nama file & folder, plus toolbar Documents lebih ringkas",
    category: "improved",
    description:
      "Di Documents kamu kini bisa mengganti nama file (nama tampilan) maupun folder langsung dari kartu/daftar. Toolbar-nya juga dirapikan: kontrol urutkan, ukuran kartu, filter tag, dan mode pilih digabung ke satu menu “Tampilan”, sehingga bar-nya tidak lagi penuh sesak tombol.",
  },
  {
    id: "2026-07-07-admin-pages-redesign",
    date: "2026-07-07",
    title: "Tampilan baru: halaman Brand, Web Setting, Peran & Pengguna",
    category: "improved",
    description:
      "Empat halaman pengelolaan didesain ulang agar lebih rapi dan informatif. Brand kini tampil sebagai galeri kartu dengan logo, warna tema, serta jumlah produk/proyek/room. Web Setting punya pratinjau langsung (sidebar, tab browser, dan notifikasi) saat kamu mengganti logo atau nama. Halaman Peran memakai kartu berwarna per tier, dan Pengguna menampilkan foto, status online, serta pencarian & filter peran.",
    highlights: [
      "Brand: galeri kartu dengan pratinjau langsung saat menambah/mengubah brand",
      "Web Setting: unggah logo, favicon & ikon dengan pratinjau seketika",
      "Peran & Pengguna: kartu berwarna, status online, cari & filter peran",
    ],
  },
  {
    id: "2026-07-07-dropdown-labels-fix",
    date: "2026-07-07",
    title: "Dropdown di seluruh aplikasi menampilkan label yang benar",
    category: "fixed",
    description:
      "Sebelumnya sebagian menu pilihan menampilkan kode mentah seperti \"ROOM_MANAGER\" atau \"__pick__\" alih-alih teks yang mudah dibaca. Kini semua dropdown di aplikasi — Finance, Research Hub, Brand Hub, ruangan, tugas, dan lainnya — menampilkan label yang benar dan manusiawi.",
  },
  {
    id: "2026-07-07-themed-scrollbar",
    date: "2026-07-07",
    title: "Scrollbar mengikuti warna tema pilihanmu",
    category: "improved",
    description:
      "Batang penggulir (scrollbar) di semua halaman kini mengikuti warna tema yang kamu pilih di profil, tidak lagi memakai abu-abu bawaan browser. Berlaku di seluruh area yang bisa di-scroll dan menyesuaikan otomatis begitu kamu berganti tema.",
  },
  {
    id: "2026-07-07-direct-chat-redesign",
    date: "2026-07-07",
    title: "Tampilan chat langsung diperbarui",
    category: "improved",
    description:
      "Tampilan percakapan langsung (direct chat) dipoles: gelembung pesan lebih membulat dan pesan beruntun dari orang yang sama ditampilkan lebih ringkas, sehingga percakapan terasa lebih rapi dan mudah diikuti.",
  },
  {
    id: "2026-07-06-finance-polish",
    date: "2026-07-06",
    title: "Finance — pemolesan lanjutan: koreksi periode tutup buku, aset, budget",
    category: "improved",
    description:
      "Jurnal di periode yang sudah dikunci kini bisa dikoreksi lewat jurnal pembalik bertanggal periode terbuka (tanpa membuka kunci). Aset tetap baru bisa langsung dijurnalkan perolehannya, baris budget tidak bisa dobel untuk sel yang sama, keputusan approval yang berbarengan tidak saling menimpa, dan neraca per-brand kini menjelaskan bahwa segmen memang tidak harus seimbang.",
  },
  {
    id: "2026-07-06-finance-attachment-hygiene",
    date: "2026-07-06",
    title: "Finance — lampiran diverifikasi isinya & file tidak tertinggal",
    category: "improved",
    description:
      "Lampiran struk/invoice kini diverifikasi dari isi file-nya (bukan sekadar label tipe dari browser yang bisa dipalsukan), dan menghapus draf jurnal/baris kini ikut membersihkan file lampirannya dari penyimpanan — tidak ada lagi dokumen sensitif yatim yang tertinggal di server.",
  },
  {
    id: "2026-07-06-finance-small-guards",
    date: "2026-07-06",
    title: "Finance — rekonsiliasi bank tervalidasi & tombol posting lebih akurat",
    category: "fixed",
    description:
      "Mencocokkan mutasi rekening koran kini hanya bisa ke baris jurnal terposting milik rekening yang sama. Tombol posting jurnal tidak lagi salah menonaktifkan diri karena pembulatan sen di browser, dan draf jurnal tidak bisa lagi dibuat dengan tanggal di periode yang sudah dikunci.",
  },
  {
    id: "2026-07-06-finance-dashboard-alignment",
    date: "2026-07-06",
    title: "Finance — KPI dashboard dan laporan kini memakai definisi yang sama",
    category: "fixed",
    description:
      "Angka masuk/keluar kas di dashboard kini menghitung dengan cara yang sama dengan laporan arus kas (transfer antar rekening tidak lagi dihitung dua sisi), total hutang/piutang tidak lagi mengikutkan dokumen yang dibatalkan, dan status seimbang neraca kini dihitung eksak di server — lengkap dengan nilai selisihnya bila tidak seimbang.",
  },
  {
    id: "2026-07-06-finance-utc-periods",
    date: "2026-07-06",
    title: "Finance — batas periode laporan kini konsisten lintas zona waktu",
    category: "fixed",
    description:
      "Semua rentang tanggal laporan, filter periode, kunci tutup buku, dan tanggal draf jurnal kini dihitung dengan patokan waktu yang sama (UTC, mengikuti cara tanggal jurnal disimpan). Transaksi di tanggal 1 atau akhir bulan tidak lagi berisiko masuk ke periode yang salah, dan kolom pembanding neraca untuk tanggal 29–31 tidak lagi salah cut-off.",
  },
  {
    id: "2026-07-06-finance-fx-rounding",
    date: "2026-07-06",
    title: "Finance — kurs valas selalu mengikuti tanggal jurnal & pembulatan konsisten",
    category: "fixed",
    description:
      "Mengubah tanggal draf jurnal kini otomatis menghitung ulang baris valuta asing dengan kurs tanggal baru (dulu diam-diam tetap memakai kurs tanggal lama). Semua nominal juga dibulatkan ke 2 desimal secara eksplisit sebelum divalidasi dan disimpan, sehingga jurnal tidak mungkin tersimpan timpang beda satu sen.",
  },
  {
    id: "2026-07-06-finance-depreciation-idempotent",
    date: "2026-07-06",
    title: "Finance — penyusutan bulanan aman dari posting ganda",
    category: "fixed",
    description:
      "Memposting penyusutan untuk bulan yang sama dua kali kini ditolak dengan pesan jelas (dulu bebannya tercatat dobel). Pembaruan nilai akumulasi penyusutan aset juga kini satu paket transaksi dengan jurnalnya — kegagalan di tengah tidak lagi membuat register aset menyimpang.",
  },
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
