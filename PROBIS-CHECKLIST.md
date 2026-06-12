# PTR Lengkap — Probis DCC Checklist

> **Tujuan:** memvalidasi seluruh 14 modul bisnis DCC end-to-end sebelum branch `feat/attendance` di-merge ke `main` / di-deploy ke production.
>
> **Cara pakai:**
> 1. Jalankan stack lokal (lihat **M0**).
> 2. Eksekusi skenario per modul. Centang `[x]` bila lolos sesuai _Expected_.
> 3. Bila gagal: catat reproduksinya di slot **🐛 Bugs ditemukan** pada modul terkait.
> 4. Penomoran `M{modul}.{skenario}` (mis. `M14.3`) — pakai saat lapor bug.
>
> **Akseptasi:** ≥ 95% skenario hijau, ditambah **wajib lulus** skenario kritis: M1 (Auth), M14 (Absensi), M10 jurnal posting + period lock, dan M15.1 (workflow approval).

---

## M0. Persiapan

### M0.1 — Stack lokal
- [ ] `docker compose up -d db` → postgres siap (port 5432)
- [ ] `npm run db:push` → skema tersinkron
- [ ] `npm run db:seed` → akun + master data demo terbuat
- [ ] `npm run dev` → `http://localhost:3000` siap (cek `✓ Ready`)
- [ ] Browser: **Chrome**, zoom 100% (`Ctrl + 0`), izin kamera *Allow* untuk `localhost`
- [ ] Tutup aplikasi yang pakai kamera (Teams, WhatsApp, Zoom) sebelum tes modul Absensi

### M0.2 — Daftar akun uji

| Email | Password | Peran | Home |
|---|---|---|---|
| `ceo@dominatus.id` | `Zrz12345!` | CEO | `/` |
| `admin@dominatus.local` | `dcc-demo-2026` | ADMINISTRATOR | `/tasks` |
| `logistics@dominatus.local` | `dcc-demo-2026` | LOGISTICS | `/inventory` |
| `pm@dominatus.local` | `dcc-demo-2026` | PROJECT_MANAGER | `/tasks` |
| `marketing@dominatus.local` | `dcc-demo-2026` | NORMAL_USER | `/tasks` |
| `creative@dominatus.local` | `dcc-demo-2026` | NORMAL_USER | `/tasks` |
| `analyst@dominatus.local` | `dcc-demo-2026` | MARKET_ANALYST | `/research-hub` |
| `copywriter@dominatus.local` | `dcc-demo-2026` | NORMAL_USER | `/tasks` |
| `akdzan@gmail.com` | `akdzan123` | CEO (akun reviewer) | `/` |

> ⚠️ Untuk akun FINANCE: seed tidak membuatnya by default. Bila perlu menguji M10, buat lewat `/admin/users` saat login sebagai Administrator (atau tambah di seed).

---

## M1. Auth & Login (5)

**Probis:** validasi kredensial, redirect role-aware, gate route protected.

- [ ] **M1.1** Login valid tiap role
  - **Langkah**: untuk tiap baris M0.2, buka `/login` → isi → Masuk
  - **Expected**: diarahkan ke kolom *Home* sesuai tabel; sidebar menampilkan group sesuai role

- [ ] **M1.2** Login invalid
  - **Langkah**: `ceo@dominatus.id` + password salah → Masuk
  - **Expected**: tetap di `/login`, muncul error "Email atau password salah"

- [ ] **M1.3** Logout
  - **Akun**: salah satu, sudah login
  - **Langkah**: klik **Keluar** di sidebar bawah
  - **Expected**: diarahkan ke `/login`, cookie sesi terhapus

- [ ] **M1.4** Akses protected tanpa login
  - **Langkah**: logout dulu → buka `localhost:3000/tasks` di tab incognito
  - **Expected**: redirect ke `/login?callbackUrl=%2Ftasks`

- [ ] **M1.5** Re-akses /login saat sudah login
  - **Akun**: CEO
  - **Langkah**: sudah login, buka `localhost:3000/login`
  - **Expected**: langsung redirect ke `/`

🐛 **Bugs ditemukan:** _(kosongkan jika tidak ada)_

---

## M2. Dashboard / Executive Overview (CEO, 4)

**Probis:** CEO memantau KPI eksekutif harian.

- [ ] **M2.1** KPI render
  - **Akun**: CEO
  - **Langkah**: buka `/`
  - **Expected**: 6 stat cards (SKU/Supplier/Stok perlu perhatian/Tugas overdue/Siap peluncuran/Persetujuan), Pipeline produksi, Barang keluar per brand, Stok kritis

- [ ] **M2.2** Tautan persetujuan
  - **Akun**: CEO
  - **Langkah**: klik "Buka halaman persetujuan"
  - **Expected**: pindah ke `/approvals`

- [ ] **M2.3** Non-CEO ditolak
  - **Akun**: Administrator, Logistics, NORMAL_USER, PM
  - **Langkah**: buka `localhost:3000/`
  - **Expected**: redirect ke home masing-masing role (sesuai M0.2)

- [ ] **M2.4** Refresh cache setelah stock change
  - **Akun**: Logistics (di tab 1), CEO (di tab 2)
  - **Langkah**: tab 1 catat stock OUT 1 SKU → tab 2 reload `/` setelah 60 detik
  - **Expected**: stat "Stok perlu perhatian" / "Barang keluar per brand" terupdate

🐛 **Bugs ditemukan:**

---

## M3. Inventory & Products (LOGISTICS, 6)

**Probis:** kelola produk, vendor, dan pergerakan stok.

- [ ] **M3.1** CRUD produk
  - **Akun**: Logistics
  - **Langkah**: `/products` → tambah produk → edit nama/SKU → hapus
  - **Expected**: list ter-update; produk dihapus tidak muncul

- [ ] **M3.2** Catat stock IN
  - **Langkah**: `/inventory` → pilih produk → "Catat masuk" → qty + catatan → simpan
  - **Expected**: saldo stok bertambah, baris baru di log

- [ ] **M3.3** Catat stock OUT (Penjualan vs Sampling)
  - **Langkah**: catat OUT 2× — kategori "Penjualan" lalu "Sampling"
  - **Expected**: saldo berkurang, di Barang keluar per brand kategori dipisah

- [ ] **M3.4** Koreksi: REVERSAL/REPLACEMENT/VOID
  - **Langkah**: dari log entry, jalankan masing-masing koreksi
  - **Expected**: entry baru ditag system metadata; tidak masuk ganda di laporan penjualan

- [ ] **M3.5** Min-stock alert
  - **Langkah**: kurangi stok 1 SKU sampai di bawah `minStock` → login CEO → buka `/`
  - **Expected**: "Stok perlu perhatian" naik, SKU muncul di list Stok kritis

- [ ] **M3.6** Non-LOGISTICS ditolak
  - **Akun**: NORMAL_USER
  - **Langkah**: buka `/inventory`
  - **Expected**: redirect ke `/tasks`

🐛 **Bugs ditemukan:**

---

## M4. Brands & Vendors (CEO/LOGISTICS, 3)

- [ ] **M4.1** CRUD Brand
  - **Akun**: Logistics
  - **Langkah**: `/brands` → tambah → edit → hapus (jika tidak ada produk)
  - **Expected**: list konsisten; brand dgn produk: hapus dicegah

- [ ] **M4.2** CRUD Vendor
  - **Akun**: Logistics
  - **Langkah**: `/vendors` → tambah → edit → hapus
  - **Expected**: list konsisten

- [ ] **M4.3** Non-authorized ditolak
  - **Akun**: PM / NORMAL_USER
  - **Langkah**: buka `/brands`
  - **Expected**: redirect

🐛 **Bugs ditemukan:**

---

## M5. Tasks & Kanban (Studio/PM/CEO/ADMIN, 8)

**Probis:** alur tugas dari pembuatan, assignment, eksekusi, sampai persetujuan.

- [ ] **M5.1** Buat tugas
  - **Akun**: PM
  - **Langkah**: `/tasks` → New Task → judul + deskripsi + due → simpan
  - **Expected**: muncul di Kanban kolom TODO

- [ ] **M5.2** Assign PIC (PM only)
  - **Akun**: PM
  - **Langkah**: edit task → pilih PIC: NORMAL_USER
  - **Expected**: PIC ter-set; assignee notification (jika subscribe push)

- [ ] **M5.3** Pindah status
  - **Akun**: PIC (NORMAL_USER)
  - **Langkah**: drag TODO → IN_PROGRESS → DONE; atau lewat menu
  - **Expected**: kolom kanban update

- [ ] **M5.4** Request approval CEO
  - **Akun**: PM
  - **Langkah**: task → toggle "Wajib persetujuan CEO" → simpan
  - **Expected**: task muncul di `/approvals` (saat login CEO)

- [ ] **M5.5** CEO approve
  - **Akun**: CEO
  - **Langkah**: `/approvals` → klik Approve pada task tsb
  - **Expected**: task → status approved, muncul di Kanban dgn badge approved

- [ ] **M5.6** Overdue detection
  - **Langkah**: buat task `due` = kemarin, status TODO → reload `/`
  - **Expected**: stat "Tugas overdue" naik 1

- [ ] **M5.7** /for-me filter
  - **Akun**: NORMAL_USER (PIC)
  - **Langkah**: buka `/for-me`
  - **Expected**: hanya task ber-PIC user tsb yang muncul

- [ ] **M5.8** Komentar & lampiran
  - **Langkah**: buka detail task → tambah komentar → upload lampiran (gambar/PDF)
  - **Expected**: tampil di thread; lampiran ter-download kembali

🐛 **Bugs ditemukan:**

---

## M6. Projects / Pipeline (CEO/Studio/PM, 6)

**Probis:** proyek bergerak antar tahap dengan persetujuan CEO.

- [ ] **M6.1** Buat proyek
  - **Akun**: PM
  - **Langkah**: `/projects` → New → brand + room + judul + tahap awal IDE → simpan
  - **Expected**: muncul di kolom IDE

- [ ] **M6.2** Maju tahap (pending)
  - **Akun**: PM
  - **Langkah**: drag/promote ke tahap berikutnya
  - **Expected**: `pendingPipelineStage` ter-set; badge "Menunggu CEO"

- [ ] **M6.3** CEO approve stage
  - **Akun**: CEO
  - **Langkah**: `/approvals` → Approve project stage
  - **Expected**: `currentStage` update, `pendingPipelineStage` null

- [ ] **M6.4** CEO reject stage
  - **Akun**: CEO
  - **Langkah**: ulangi M6.2, lalu Reject
  - **Expected**: `pendingPipelineStage` direvert; project tetap di stage sebelumnya

- [ ] **M6.5** Progress %
  - **Langkah**: buat 4 task linked ke project → tandai 2 DONE
  - **Expected**: progress di kartu project ≈ 50%

- [ ] **M6.6** Hapus proyek dengan room aktif
  - **Langkah**: coba hapus project yang masih punya room/document
  - **Expected**: ditolak dengan pesan "reassign room dulu"

🐛 **Bugs ditemukan:**

---

## M7. Rooms (12)

**Probis:** workspace kolaboratif per ruangan.

- [ ] **M7.1** Buat ruangan
  - **Akun**: Administrator
  - **Langkah**: `/rooms` → New → nama + brand → simpan
  - **Expected**: ruangan muncul di hub

- [ ] **M7.2** Chat: kirim pesan
  - **Akun**: anggota
  - **Langkah**: `/room/[id]/chat` → tulis pesan → Enter
  - **Expected**: muncul real-time; timestamp betul

- [ ] **M7.3** Chat: GIPHY (jika `GIPHY_API_KEY` di-set)
  - **Langkah**: tombol GIF → cari → kirim
  - **Expected**: GIF terkirim sebagai pesan

- [ ] **M7.4** Chat: typing indicator
  - **Langkah**: 2 tab anggota berbeda; tab A ketik
  - **Expected**: tab B lihat "…sedang mengetik"

- [ ] **M7.5** Documents: upload + download
  - **Langkah**: `/room/[id]/documents` → upload PDF/gambar → klik download
  - **Expected**: file ter-download utuh

- [ ] **M7.6** Documents: folder & versioning
  - **Langkah**: buat folder → drop dokumen → upload versi baru
  - **Expected**: tampil terurut createdAt, versi lama tetap

- [ ] **M7.7** Members: tambah & hapus anggota
  - **Akun**: Administrator
  - **Langkah**: `/room/[id]/members` → Add → pilih user → set role
  - **Expected**: muncul di daftar; hapus → user kehilangan akses

- [ ] **M7.8** Content planning: tambah item
  - **Langkah**: `/room/[id]/content-planning` → New item → jenis + status → simpan
  - **Expected**: item muncul; filter by status berfungsi

- [ ] **M7.9** Views: buat view baru
  - **Langkah**: `/room/[id]/view` → New → pilih tipe (Calendar/Timeline/List/Wiki/Glossary/Links/Kanban)
  - **Expected**: redirect ke `/view/[viewId]` baru; bisa kembali ke hub

- [ ] **M7.10** Views: switch antar tipe
  - **Langkah**: buat ≥ 3 view berbeda tipe, pindah antar tab
  - **Expected**: data per view terpelihara

- [ ] **M7.11** Non-member ditolak
  - **Akun**: user yang bukan anggota
  - **Langkah**: buka `/room/[id]/chat` ruangan yg bukan miliknya
  - **Expected**: error 403 / redirect

- [ ] **M7.12** Hapus ruangan
  - **Akun**: Administrator
  - **Langkah**: hapus 1 room
  - **Expected**: room hilang; tugas tertaut soft-archive

🐛 **Bugs ditemukan:**

---

## M8. Schedule (semua role, 4)

- [ ] **M8.1** Buat event
  - **Langkah**: `/schedule` → New → judul + waktu + peserta → simpan
  - **Expected**: muncul di grid waktu yg tepat

- [ ] **M8.2** Edit & hapus event
  - **Langkah**: klik event → edit waktu → simpan; lalu Delete
  - **Expected**: berubah/hilang

- [ ] **M8.3** Recurrence
  - **Langkah**: buat event DAILY + recurrenceUntil = 7 hari lagi
  - **Expected**: muncul 7 instance; setelah cutoff tidak muncul

- [ ] **M8.4** Peserta dapat notifikasi
  - **Langkah**: tambahkan akun lain sebagai peserta
  - **Expected**: di akun peserta muncul event; jika WhatsApp gateway aktif, terkirim notif H-1/H-1jam (lihat `sync-schedule-reminders.ts` cron)

🐛 **Bugs ditemukan:**

---

## M9. Approvals (CEO, 4)

- [ ] **M9.1** Lihat antrian
  - **Akun**: CEO
  - **Langkah**: buka `/approvals`
  - **Expected**: list task + project stage pending; counter benar

- [ ] **M9.2** Approve task
  - **Langkah**: klik Approve pada task
  - **Expected**: task hilang dari antrian; di /tasks → `isApproved=true`

- [ ] **M9.3** Reject project stage
  - **Langkah**: klik Reject pada project stage
  - **Expected**: stage direvert; tampak di /projects

- [ ] **M9.4** Non-CEO ditolak
  - **Akun**: PM / Administrator
  - **Langkah**: buka `/approvals`
  - **Expected**: redirect ke home

🐛 **Bugs ditemukan:**

---

## M10. Finance (FINANCE, 28) — kritis

> ⚠️ Skenario M10.3 (jurnal posting) dan M10.14 (period lock) **wajib lulus**.

> Catatan: jika belum ada akun FINANCE, buat dulu via `/admin/users` (login sebagai Administrator) — atau seed manual.

### M10.A Ringkasan & COA
- [ ] **M10.1** Ringkasan: KPI + period selector
  - **Akun**: FINANCE
  - **Langkah**: `/finance` → ganti periode YYYY-MM
  - **Expected**: KPI (revenue/expense/cashflow) berubah sesuai periode; ada indikator periode terkunci

- [ ] **M10.2** Chart of Accounts: CRUD akun
  - **Langkah**: `/finance/chart-of-accounts` → tambah akun (asset/liability/equity/revenue/expense), set parent → simpan
  - **Expected**: hirarki tampil; edit nama → reflect; hapus akun tanpa entry → boleh; dgn entry → ditolak

### M10.B Jurnal & GL
- [ ] **M10.3** ⭐ Jurnal: posting double-entry valid
  - **Langkah**: `/finance/journals` → New → buat 2 line: 1 debit + 1 kredit dgn jumlah sama (mis. 1.000.000 vs 1.000.000) → Post
  - **Expected**: status Posted; entry muncul di Buku Besar

- [ ] **M10.4** Jurnal: D≠K ditolak
  - **Langkah**: ulangi tapi jumlah debit ≠ kredit → Post
  - **Expected**: error "debit tidak sama dengan kredit", tidak ter-post

- [ ] **M10.5** Jurnal: lampiran
  - **Langkah**: edit jurnal → tambah attachment (PDF) ke line
  - **Expected**: file ter-upload, bisa dilihat & download

- [ ] **M10.6** Buku Besar: filter
  - **Langkah**: `/finance/general-ledger` → pilih COA + periode → cari
  - **Expected**: hanya entry COA & periode itu yg tampil

### M10.C Bank, Currency, Treasury
- [ ] **M10.7** Bank: import statement
  - **Langkah**: `/finance/bank` → Import → upload sample → match dgn jurnal
  - **Expected**: baris ter-import; cocokkan ke jurnal sukses

- [ ] **M10.8** Kurs Mata Uang: tambah/update
  - **Langkah**: `/finance/currencies` → tambah USD/IDR per tanggal → update rate baru
  - **Expected**: list rate sorted by date; revaluation memakai rate aktif

- [ ] **M10.9** Treasury: kas pool & forecast
  - **Langkah**: `/finance/treasury` → lihat saldo kas + forecast
  - **Expected**: ringkasan render; nilai konsisten dgn jurnal Posted

### M10.D AP/AR, Costing, Budget
- [ ] **M10.10** AP & AR: buat tagihan
  - **Langkah**: `/finance/ap-ar` → New bill / invoice → set vendor/customer + due
  - **Expected**: muncul di aging; status OPEN

- [ ] **M10.11** AP: catat pembayaran
  - **Langkah**: dari bill OPEN → "Record payment" → bank account → jumlah → simpan
  - **Expected**: status PAID; jurnal otomatis tercatat (di GL)

- [ ] **M10.12** Brand & Costing: alokasi
  - **Langkah**: `/finance/brands-costing` → pilih expense COA → alokasi ke brand
  - **Expected**: rasio terlihat di Budget vs Aktual

- [ ] **M10.13** Budget vs Aktual
  - **Langkah**: `/finance/budget` → set budget per COA bulan ini → bandingkan
  - **Expected**: variance % tampil; aktual = total jurnal Posted bulan ini

### M10.E Persetujuan, Aset, Laporan, Period Lock
- [ ] **M10.14** ⭐ Period Lock
  - **Langkah**: `/finance` → kunci periode YYYY-MM lalu → coba post jurnal pada periode terkunci
  - **Expected**: ditolak "periode terkunci"

- [ ] **M10.15** Persetujuan pengeluaran
  - **Langkah**: `/finance/approvals` → ajukan, approve, reject
  - **Expected**: workflow status berubah konsisten

- [ ] **M10.16** Aset Tetap: depresiasi
  - **Langkah**: `/finance/fixed-assets` → register asset → jalankan depresiasi bulan ini
  - **Expected**: jurnal beban depresiasi otomatis posted

- [ ] **M10.17** Laporan: P&L / BS / Cashflow
  - **Langkah**: `/finance/reports` → pilih periode → render & export
  - **Expected**: angka konsisten dgn GL; export CSV/PDF (jika tersedia)

### M10.F Akses & rate
- [ ] **M10.18** Non-FINANCE ditolak
  - **Akun**: NORMAL_USER / PM
  - **Langkah**: buka `/finance`
  - **Expected**: redirect ke home role-nya

🐛 **Bugs ditemukan:**

---

## M11. Admin (ADMINISTRATOR, 6)

- [ ] **M11.1** Users: CRUD
  - **Akun**: Administrator
  - **Langkah**: `/admin/users` → tambah user (email + role + password) → edit → hapus
  - **Expected**: user baru bisa login; perubahan tampak; tidak bisa hapus diri sendiri

- [ ] **M11.2** Users: set custom role
  - **Langkah**: edit user → pilih custom role (mis. "DevOps Engineer" tier LOGISTICS)
  - **Expected**: label peran di sidebar/profile = custom role; tier permission = LOGISTICS

- [ ] **M11.3** Roles: CRUD custom role
  - **Langkah**: `/admin/roles` → New "QA Engineer" tier NORMAL_USER → simpan; edit; hapus
  - **Expected**: role tampil di dropdown user; protected role (CEO/Administrator/Finance/Logistik) tidak bisa dihapus

- [ ] **M11.4** Branding: upload logo
  - **Langkah**: `/admin/branding` → upload logo PNG, set nama app & subtitle nav → simpan
  - **Expected**: sidebar header berubah; favicon update (refresh)

- [ ] **M11.5** Access audit (jika tersedia)
  - **Langkah**: `/admin/access` → lihat aktivitas terbaru
  - **Expected**: log perubahan role / login terdaftar

- [ ] **M11.6** Non-ADMIN ditolak
  - **Akun**: NORMAL_USER
  - **Langkah**: buka `/admin/users`
  - **Expected**: redirect

🐛 **Bugs ditemukan:**

---

## M12. Profile (semua role, 3)

- [ ] **M12.1** Edit profil
  - **Akun**: any
  - **Langkah**: `/profile` → ubah nama, bio, WA, banner preset/pattern, sticker, accent → simpan
  - **Expected**: reflect di `/profile/[me]` & sidebar avatar

- [ ] **M12.2** Ganti password
  - **Langkah**: profile → ganti password (lama + baru) → simpan → logout → login baru
  - **Expected**: bisa login dgn password baru, lama ditolak

- [ ] **M12.3** Lihat profil user lain
  - **Langkah**: dari rooms/tasks klik nama user lain
  - **Expected**: `/profile/[userId]` render read-only

🐛 **Bugs ditemukan:**

---

## M13. For-Me (Studio/PM/CEO, 2)

- [ ] **M13.1** Filter "PIC = saya"
  - **Akun**: NORMAL_USER yang jadi PIC ≥ 1 task
  - **Langkah**: buka `/for-me`
  - **Expected**: hanya task PIC user tsb; sorted by due

- [ ] **M13.2** CEO: lihat pending approvals juga
  - **Akun**: CEO
  - **Langkah**: `/for-me`
  - **Expected**: section tambahan "Persetujuan menunggu Anda"

🐛 **Bugs ditemukan:**

---

## M14. ABSENSI ⭐ (22)

**Probis:** karyawan absensi mandiri (face recognition 1:1), admin pantau.

### M14.A Enrollment

- [ ] **M14.1** Belum daftar → prompt enroll
  - **Akun**: user baru / akun yg face-nya direset
  - **Langkah**: buka `/attendance`
  - **Expected**: card "Wajah Anda belum terdaftar" + tombol "Daftarkan Wajah Sekarang"

- [ ] **M14.2** Enrollment kamera (4 pose)
  - **Langkah**: pilih "Scan Kamera" → ikuti panduan: depan → kiri → kanan → senyum
  - **Expected**: tiap pose validateFacePose() lolos, di-capture, progress bullet hijau; akhir → "Pengambilan Wajah Selesai" → klik Simpan → kembali ke home

- [ ] **M14.3** Enrollment upload foto
  - **Akun**: user lain (yg face-nya direset)
  - **Langkah**: pilih "Upload Foto" → pilih 1-5 foto wajah → Proses
  - **Expected**: tiap foto status sukses; jika foto tanpa wajah → status error "Wajah tak terdeteksi"; akhir → Simpan

- [ ] **M14.4** Replace atomic
  - **Akun**: user yg sudah punya wajah
  - **Langkah**: di home → "Perbarui data wajah" → enroll lagi → Simpan
  - **Expected**: face data lama hilang, baru tersimpan (cek di tab Registrasi admin: jumlah descriptor diperbarui)

### M14.B Check-in / Check-out (face verify)

- [ ] **M14.5** ⭐ Check-In sukses
  - **Akun**: yg sudah enrolled
  - **Langkah**: `/attendance` → Check In → biarkan kamera → kedipkan mata
  - **Expected**: status "Wajah cocok — kedipkan mata" → "Wajah terverifikasi" (≥ 50%) → form rencana kerja → "Konfirmasi Check In" → toast sukses; status hari ini berubah jadi "Masuk HH:MM"

- [ ] **M14.6** Check-Out sukses
  - **Langkah**: ulangi tapi pilih Check Out → form tugas selesai → konfirmasi
  - **Expected**: status hari ini "Pulang HH:MM"

- [ ] **M14.7** Blink fallback 4s
  - **Langkah**: Check In, JANGAN kedipkan mata, tahan posisi
  - **Expected**: setelah ~4 detik, otomatis verified (fallback)

- [ ] **M14.8** Wajah orang lain
  - **Langkah**: Check In; minta orang lain (atau foto orang lain) berdiri di depan kamera
  - **Expected**: setelah ≥ 18 frame mismatch → status merah "Wajah tidak cocok dengan akun Anda…"

### M14.C Absence (Sakit/Izin)

- [ ] **M14.9** Sakit dgn alasan
  - **Langkah**: `/attendance` → Sakit → isi alasan "Demam" → Kirim
  - **Expected**: record `type=SICK`; status hari ini "Sakit tercatat"

- [ ] **M14.10** Izin dgn alasan
  - **Langkah**: Izin → "Ada keperluan" → Kirim
  - **Expected**: record `type=PERMISSION`; chip status muncul

- [ ] **M14.11** Sakit/Izin alasan kosong ditolak
  - **Langkah**: Sakit → kosongkan → Kirim
  - **Expected**: tombol disabled / error "Alasan wajib diisi"

### M14.D Dup-prevention & history

- [ ] **M14.12** Dup-prevention < 15s
  - **Langkah**: Check In sukses → langsung Check Out lagi dalam < 15s
  - **Expected**: HTTP 429 + UI "Anda baru saja absen. Tunggu sebentar lalu coba lagi."

- [ ] **M14.13** Riwayat saya
  - **Langkah**: di home Absensi, scroll ke "Riwayat Absensi Saya"
  - **Expected**: table sampai 60 record; expand "Lihat" → detail rencana/tugas/alasan; status badge benar

### M14.E Camera & Strict Mode

- [ ] **M14.14** Camera busy
  - **Langkah**: nyalakan Teams kamera dulu → buka /attendance → Check In
  - **Expected**: error spesifik "Kamera sedang dipakai aplikasi/tab lain (Teams, Zoom, WhatsApp, dll)…"

- [ ] **M14.15** Camera permission ditolak
  - **Langkah**: Chrome → site settings localhost → Camera = Block → reload → Check In
  - **Expected**: error "Izin kamera ditolak. Klik ikon kamera di address bar…"

- [ ] **M14.16** Camera tidak ada
  - **Langkah**: (jika memungkinkan) cabut webcam eksternal / disable di Device Manager
  - **Expected**: "Kamera tidak ditemukan di perangkat ini."

- [ ] **M14.17** Strict Mode regression (dev double-mount)
  - **Langkah**: di dev, buka Check In → tutup Cancel → buka lagi → ulangi 3×
  - **Expected**: kamera tidak nyangkut / tidak pernah error "Gagal mengakses kamera" (bug yg sudah di-fix di `useWebcam` — `startingRef` + `wantCameraRef`)

### M14.F Admin Rekap

- [ ] **M14.18** Tab **Dashboard**
  - **Akun**: CEO / Administrator
  - **Langkah**: `/attendance/rekap` → tab Dashboard
  - **Expected**: 6 stat cards (Hadir/CheckIn/CheckOut/Sakit/Izin/Wajah terdaftar), grafik batang 7 hari (recharts), bar kehadiran per peran, status karyawan hari ini, aktivitas terkini

- [ ] **M14.19** Tab **Rekap** — preset & filter
  - **Langkah**: tab Rekap → klik preset (Hari Ini/7/30/Bulan Ini/Bulan Lalu) → ganti jenis (Check In/Out/Sakit/Izin) → cari nama
  - **Expected**: table refresh otomatis (lewat searchParams effect), jumlah baris sesuai; loading state derived (`loadedSig != filterSig`)

- [ ] **M14.20** Tab **Rekap** — Export CSV
  - **Langkah**: klik "Export CSV"
  - **Expected**: file `absensi-dominatus-YYYY-MM-DD.csv` ter-download; buka di Excel — kolom: Tanggal, Waktu, Nama, Peran, Status, Confidence, Alasan; BOM UTF-8 (nama non-ASCII benar)

- [ ] **M14.21** Tab **Rekap** — Cleanup data lama
  - **Langkah**: klik "Bersihkan Data Lama" → pilih "3 bulan lalu" → Hapus
  - **Expected**: toast "X catatan dihapus"; table refresh; record sebelum tanggal hilang

- [ ] **M14.22** Tab **Registrasi Wajah** — reset
  - **Langkah**: pilih user yg sudah daftar → klik Reset → konfirmasi
  - **Expected**: status user jadi "Belum daftar"; DELETE /api/face-data?userId=… 200; record absensi yg sudah ada **tidak ikut hilang** (audit trail terjaga)

### M14.G Akses

- [ ] **M14.23** Non-admin akses /attendance/rekap
  - **Akun**: NORMAL_USER (Akdzan-style: ganti role lewat /admin/users dulu, atau pakai akun seed lain)
  - **Langkah**: buka `localhost:3000/attendance/rekap`
  - **Expected**: di-redirect ke `/attendance` (page-level gate via `isAttendanceAdmin`)

🐛 **Bugs ditemukan:**

---

## M15. Cross-module flows (5)

> Validasi bahwa lintas-modul tetap konsisten.

- [ ] **M15.1** ⭐ Workflow approval task end-to-end
  - **Akun**: PM, NORMAL_USER, CEO
  - **Langkah**:
    1. PM buat task → assign NORMAL_USER → toggle "Wajib persetujuan CEO"
    2. NORMAL_USER login → /for-me → kerjakan → status DONE
    3. CEO login → /approvals → Approve
  - **Expected**: task tampil di Kanban dgn badge approved; di /for-me NORMAL_USER status final

- [ ] **M15.2** Project stage approval end-to-end
  - **Akun**: PM, CEO
  - **Langkah**: PM advance stage → CEO approve → cek `/projects` & `/`
  - **Expected**: dashboard CEO "Siap peluncuran" / stage update

- [ ] **M15.3** Akdzan check-in → muncul di rekap
  - **Akun**: Akdzan
  - **Langkah**: login Akdzan → Absensi → Check In sukses → buka /attendance/rekap → tab Dashboard
  - **Expected**: nama "Muhamad Akdzan Angganegara" muncul di "Aktivitas Terkini" + "Status Karyawan Hari Ini" hijau

- [ ] **M15.4** Stock change → dashboard CEO
  - **Akun**: Logistics, CEO
  - **Langkah**: Logistics catat 2 OUT → CEO reload `/` setelah ≥ 60s
  - **Expected**: "Barang keluar per brand" terupdate; "Stok perlu perhatian" reflect

- [ ] **M15.5** Admin buat user → user login dgn role-home benar
  - **Akun**: Administrator
  - **Langkah**: buat user dgn role FINANCE → logout → login user baru
  - **Expected**: diarahkan ke `/finance`; sidebar tampil group Finance

🐛 **Bugs ditemukan:**

---

## Ringkasan eksekusi

| Modul | Total | Lulus | Gagal |
|---|---:|---:|---:|
| M1  Auth | 5 |  |  |
| M2  Dashboard | 4 |  |  |
| M3  Inventory | 6 |  |  |
| M4  Brands & Vendors | 3 |  |  |
| M5  Tasks | 8 |  |  |
| M6  Projects | 6 |  |  |
| M7  Rooms | 12 |  |  |
| M8  Schedule | 4 |  |  |
| M9  Approvals | 4 |  |  |
| M10 Finance | 18 |  |  |
| M11 Admin | 6 |  |  |
| M12 Profile | 3 |  |  |
| M13 For-Me | 2 |  |  |
| M14 Absensi | 23 |  |  |
| M15 Cross-module | 5 |  |  |
| **Total** | **109** | | |

**Catatan reviewer:**

- Tanggal eksekusi: _________________
- Reviewer: _________________
- Branch: `feat/attendance` (commit: _________________)
- Status akhir: ☐ Approve merge  ☐ Block merge (lihat bugs)
