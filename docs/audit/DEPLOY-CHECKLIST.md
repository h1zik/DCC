# DEPLOY CHECKLIST — DCC (khususnya modul Finance)

Urutan deploy aman ke produksi (Railway). Berlaku untuk SETIAP deploy yang
membawa perubahan schema database; langkah verifikasi finance berlaku untuk
setiap deploy yang menyentuh modul Finance.

> Prinsip: **tidak pernah `prisma db push` ke produksi**, tidak pernah
> `--accept-data-loss`, semua perubahan schema lewat migration SQL yang sudah
> di-review di PR.

---

## 0. Satu kali saja — baseline database produksi

Database produksi dibuat lewat `db push` (tanpa riwayat migrasi), sehingga
sebelum `prisma migrate deploy` pertama, migration `0_init` harus ditandai
sudah-applied (metadata saja, tidak mengubah schema/data):

```bash
# via Railway shell / railway run, dengan DATABASE_URL produksi
npx prisma migrate resolve --applied 0_init
npx prisma migrate status   # harus: "Database schema is up to date!"
```

Kalau `migrate status` masih menunjukkan drift, STOP — jangan lanjut deploy;
selisihnya harus dibuat sebagai migration baru yang di-review, bukan di-push.

## 1. Sebelum deploy

- [ ] **Backup terverifikasi ada.** Cek Railway backup terbaru (atau jalankan
      `npm run db:backup` dari mesin yang punya akses + `pg_dump`). Catat
      timestamp backup; jangan lanjut bila backup terakhir lebih tua dari
      data yang tidak rela hilang.
- [ ] **PR sudah hijau**: `npm run lint && npm run test && npm run build &&
      npx prisma validate` lulus di branch yang akan di-deploy.
- [ ] **Review SQL migration** yang ikut di PR (`prisma/migrations/*/migration.sql`):
      pastikan additive (CREATE TABLE / ADD COLUMN nullable-atau-default /
      CREATE INDEX / ADD CONSTRAINT). Perubahan destruktif (DROP/ALTER TYPE
      yang rewrite) harus sudah dipecah expand → migrate data → contract dan
      disetujui eksplisit.
- [ ] **Constraint baru vs data lama**: bila migration menambah UNIQUE/CHECK
      constraint, jalankan dulu query deteksi duplikat/pelanggar di replika
      atau lewat query read-only (daftar query ada di bagian 4 laporan audit
      `finance-audit-2026-07-06.md`, "Perlu Verifikasi Manual" butir 4).
      Constraint yang gagal apply akan membatalkan deploy.

## 2. Deploy

- [ ] Merge PR → build.
- [ ] Terapkan migration: `npm run db:deploy` (= `prisma migrate deploy`,
      **bukan** `db push`). Perintah ini hanya menjalankan migration yang
      sudah di-commit, tidak pernah men-diff schema sendiri.
- [ ] `npm run db:migrate-status` → semua migration `applied`, tanpa pending.

## 3. Verifikasi pasca-deploy (finance)

- [ ] **Angka summary = angka ledger.** Buka `/finance/reports` → Trial
      Balance: badge harus "Seimbang" (total debit = total kredit). Bandingkan
      "Saldo Kas & Bank" di dashboard `/finance` dengan total akun kas/bank di
      Balance Sheet — selisih yang tidak bisa dijelaskan = investigasi sebelum
      dipakai.
- [ ] **Smoke test posting jurnal di data dummy, lalu void:**
      1. Buat jurnal draf baru (mis. debit `6xxx Beban lain` / kredit
         `1000 Kas`, nominal kecil mis. Rp 1.000, memo `SMOKE-TEST-DEPLOY`).
      2. Posting → pastikan sukses, dapat nomor `JE-YYYY-NNNNNN`, muncul di
         General Ledger.
      3. Balik (reverse) jurnal tersebut → pastikan jurnal pembalik terposting
         dan saldo akun kembali ke nilai semula.
      4. Cek Trial Balance masih "Seimbang".
- [ ] **Spot-check AP/AR**: total aging di `/finance/ap-ar` masuk akal
      dibanding sebelum deploy (tidak tiba-tiba 0 atau berlipat).
- [ ] **Error monitor**: pantau log Railway ±15 menit untuk error Prisma
      (P2002/P2003 = constraint) atau 500 di rute `/finance*`.

## 3b. Tugas data satu-kali — rilis "konsistensi sub-ledger" (H-07/H-08)

Berlaku sekali, saat rilis yang membawa perubahan `fix/finance-subledger-consistency`:

- [ ] **Rekening bank lama**: untuk setiap rekening dengan saldo awal ≠ 0 yang
      dibuat SEBELUM rilis ini, saldo awalnya belum pernah dijurnal. Dashboard
      kas kini murni membaca ledger, jadi buat jurnal saldo awal manual lewat
      UI (debit akun bank, kredit `3000 Modal pemilik`, tanggal = tanggal saldo
      awal rekening; kalau periodenya sudah dikunci, pakai tanggal awal periode
      terbuka). Setelah itu angka kas dashboard = neraca.
- [ ] **Bill/invoice lama** yang dibuat lewat form AP/AR (bukan editor jurnal)
      juga belum pernah dijurnal ke akun kontrol 2000/1200 — bila ingin neraca
      historis cocok dengan aging, buat jurnal pengakuan manual per dokumen
      terbuka (debit beban / kredit 2000 untuk bill; debit 1200 / kredit
      pendapatan untuk invoice) bertanggal di periode terbuka.

## 4. Rollback

- Kesalahan kode → redeploy commit sebelumnya (migration additive aman
  dibiarkan ter-apply).
- Kesalahan data/migration → restore dari backup langkah 1; karena semua
  migration additive, restore + redeploy versi lama selalu memungkinkan.
  JANGAN mencoba "membalik" migration dengan db push.

---

*Checklist ini deliverable FASE 2 audit finance (lihat
`docs/audit/finance-audit-2026-07-06.md`, temuan H-10).*
