# AUDIT & PERBAIKAN MODUL FINANCE DCC

## Konteks
Kamu bekerja di repo DCC (Dominatus Control Center) — Next.js 16 App Router + Prisma 6
+ PostgreSQL, deploy di Railway. Baca README.md dan (jika ada) AGENTS.md/CLAUDE.md dulu.
Modul Finance mencakup: Financial Overview, Chart of Accounts, Journals & General
Ledger, Bank Reconciliation, Exchange Rates, Cash & Treasury, AP/AR, Brand & Costing,
Budget vs Actual, Expense Approvals, Reports, Fixed Assets.

PENTING — KONTEKS DATA: Database produksi berisi data finance RIIL yang sangat penting
(jurnal, kas, hutang intercompany). Pekerjaanmu TIDAK BOLEH dalam bentuk apa pun
menyentuh, mengubah, atau berisiko menghapus data produksi.

## Aturan keras (berlaku di semua fase)
1. JANGAN PERNAH konek ke DATABASE_URL produksi. Semua eksekusi hanya ke DB lokal/dev.
2. DILARANG memakai `prisma db push --accept-data-loss` dalam bentuk apa pun.
   Kalau menemukan script npm yang memakainya (db:migrate, db:deploy), itu adalah
   TEMUAN AUDIT — usulkan penggantinya berbasis `prisma migrate` yang ter-review.
3. Perubahan schema harus ADDITIVE-ONLY: tambah kolom nullable/default, tambah tabel,
   tambah index. DILARANG: drop table/column, rename destruktif, ubah tipe yang butuh
   rewrite data. Kalau refactor butuh perubahan destruktif, tulis sebagai proposal
   multi-step (expand → migrate data → contract) dan STOP untuk minta persetujuan.
4. Jangan mengubah data lewat script/seed yang menyasar tabel finance.
5. Setiap perubahan kode harus disertai test (Vitest) dan lolos:
   `npm run lint && npm run test && npm run build && npx prisma validate`.

## FASE 1 — AUDIT (read-only, kerjakan sekarang)
Analisa seluruh modul Finance: halaman di src/app/(dashboard)/, server actions di
src/actions/, route handlers /api/*, logika di src/lib/, dan model Prisma terkait.

Periksa minimal:
a. **Integritas double-entry**: apakah posting jurnal menjamin total debit = kredit
   (di level DB constraint/transaction, bukan cuma validasi UI)? Bisakah jurnal
   di-post dua kali / diedit setelah posted? Ada audit trail?
b. **Transaksi & race condition**: operasi multi-tabel (posting, rekonsiliasi,
   approval) dibungkus transaction? Idempotent? Aman dari double-submit?
c. **Pembulatan & currency**: tipe data uang (float vs Decimal?), konsistensi
   pembulatan, penanganan kurs.
d. **Otorisasi**: setiap route/action finance mengecek role dengan benar? Ada
   endpoint yang bocor ke role lain? Cek juga /api/ai/* yang membaca data finance.
e. **Konsistensi agregat**: angka dashboard/summary dihitung dari sumber yang sama
   dengan ledger? Ada risiko drift?
f. **Soft delete vs hard delete**: entitas finance bisa dihapus permanen? Seharusnya
   minimal soft-delete + jejak.
g. **Validasi input**: zod dipakai konsisten? Tanggal periode tutup buku bisa
   di-backdate bebas?
h. **Test coverage**: bagian finance mana yang belum tertutup test.
i. **ALLOW_DEMO_DATA**: pastikan tidak ada jalur demo-data yang bisa menulis ke
   tabel finance di produksi.

Output Fase 1: file `docs/audit/finance-audit-YYYY-MM-DD.md` berisi temuan
ber-severity (Critical / High / Medium / Low), masing-masing dengan: lokasi file,
penjelasan, bukti (potongan kode), dan usulan perbaikan. Akhiri dengan ringkasan
eksekutif ≤10 baris dan urutan prioritas perbaikan. JANGAN mengubah kode apa pun
di fase ini. Setelah selesai, STOP dan tunggu review.

## FASE 2 — IMPLEMENTASI (hanya setelah aku approve item per item)
- Kerjakan per temuan, satu branch/PR kecil per topik (`fix/finance-<topik>`),
  bukan satu PR raksasa.
- Setiap PR: perubahan kode + test + catatan migrasi (kalau ada) + bukti lolos
  seluruh health check di atas.
- Kalau butuh migration: hasilkan via `prisma migrate dev` di DB lokal, sertakan
  SQL-nya untuk kureview, dan tandai eksplisit apakah additive murni.
- Deliverable terakhir: `docs/audit/DEPLOY-CHECKLIST.md` berisi urutan deploy aman:
  (1) verifikasi backup Railway terbaru ada, (2) `prisma migrate deploy` (bukan
  db push), (3) urutan verifikasi pasca-deploy (angka summary = angka ledger,
  smoke test posting jurnal di data dummy lalu void).

Bahasa laporan: Indonesia. Mulai dari FASE 1 sekarang.