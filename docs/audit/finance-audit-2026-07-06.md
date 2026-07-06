# Audit Modul Finance — DCC (Dominatus Control Center)

- **Tanggal:** 2026-07-06
- **Fase:** FASE 1 — Audit read-only (tidak ada perubahan kode)
- **Cakupan:** Financial Overview, Chart of Accounts, Journals & GL, Bank Reconciliation, Exchange Rates, Cash & Treasury, AP/AR, Brand & Costing, Budget vs Actual, Expense Approvals, Reports, Fixed Assets — meliputi `src/app/(dashboard)/finance/**`, `src/actions/finance-*.ts`, `src/app/api/**` (termasuk `/api/ai/*`), `src/lib/finance-*`, `src/lib/ai-api/*`, model Prisma terkait, script npm/prisma, seed, dan test suite.
- **Metodologi:** Empat jalur audit paralel (double-entry & transaksi; currency & agregat; otorisasi & validasi; delete/test/demo-data), lalu seluruh temuan Critical/High diverifikasi ulang langsung terhadap kode sumber. Tidak ada koneksi database apa pun yang dibuat selama audit.

---

## Ringkasan Temuan

| ID | Severity | Judul singkat | Lokasi utama |
|----|----------|---------------|--------------|
| C-01 | **Critical** | Tombol "wipe" menghapus seluruh data finance, aktif di produksi | `src/actions/finance-demo.ts:11` |
| H-01 | High | Baris jurnal POSTED bisa diedit (`lineId` tak diikat ke `entryId`) | `src/actions/finance-journals.ts:268` |
| H-02 | High | Nominal `NaN`/negatif lolos validasi — bill NaN = pembayaran tanpa batas | `src/lib/finance-money.ts:5`, `finance-ap-ar.ts:85` |
| H-03 | High | Pembayaran AP/AR tidak atomik — race overpayment & data setengah jadi | `src/actions/finance-ap-ar.ts:146,226` |
| H-04 | High | Payout spend request rawan dobel pada double-submit | `src/actions/finance-spend.ts:121` |
| H-05 | High | Reversal bisa dibuat dua kali (race; tanpa unique constraint) | `src/actions/finance-journals.ts:635` |
| H-06 | High | Reversal tidak menyinkronkan sub-ledger AP/AR & spend | `src/actions/finance-journals.ts:645-675` |
| H-07 | High | Saldo awal bank tidak dijurnal — kas dashboard ≠ neraca | `src/lib/finance-dashboard.ts:126`, `finance-bank.ts:31` |
| H-08 | High | Bill/invoice bisa dibuat tanpa jurnal — sub-ledger drift dari akun kontrol | `src/actions/finance-ap-ar.ts:90,120` |
| H-09 | High | API AI: default role `CEO` bila env kosong; satu token bersama tanpa scope | `src/lib/ai-api/auth.ts:30-44` |
| H-10 | High | Deploy DB berbasis `prisma db push` tanpa riwayat migrasi | `package.json:15-16` |
| H-11 | High | Nol test untuk seluruh modul finance | `vitest.config.ts:7` |
| H-12 | High | Unlock periode = hard delete tanpa jejak, role sama dengan lock | `src/actions/finance-period-lock.ts:53` |
| M-01 | Medium | Posting jurnal tanpa compare-and-set (hanya "diselamatkan" unique `entryNumber`) | `finance-journals.ts:426-462` |
| M-02 | Medium | Tidak ada penegakan debit=kredit / non-negatif di level DB | `prisma/schema.prisma:1621` |
| M-03 | Medium | `nextJournalNumber` rawan race; error P2002 tanpa retry | `src/lib/finance-journal-number.ts:18` |
| M-04 | Medium | Cek period lock memakai client global, sering di luar transaksi | `src/lib/finance-period-lock.ts:9` |
| M-05 | Medium | PAY_BILL/RECEIVE_INVOICE saat posting: tanpa row-lock → overpay paralel | `finance-journals.ts:505,569` |
| M-06 | Medium | Depresiasi tidak idempoten; update akumulasi di luar transaksi | `src/actions/finance-assets.ts:68-151` |
| M-07 | Medium | Ganti tanggal draf tidak menghitung ulang konversi FX (kurs basi) | `finance-journals.ts:105-128` |
| M-08 | Medium | `createPostedFinanceJournal` validasi balance sebelum pembulatan per-baris | `finance-journals.ts:380-417` |
| M-09 | Medium | Hasil kali FX tidak dibulatkan eksplisit; tak ada akun selisih pembulatan | `finance-journals.ts:240` |
| M-10 | Medium | Timezone campur UTC/lokal; draf baru memakai timestamp penuh | `finance-journals.ts:89-96` dkk. |
| M-11 | Medium | Kolom pembanding neraca salah cut-off untuk tanggal 29–31 (`setMonth` rollover) | `src/actions/finance-reports.ts:336` |
| M-12 | Medium | Definisi inflow/outflow dashboard ≠ laporan arus kas (transfer internal) | `src/lib/finance-dashboard.ts:83` |
| M-13 | Medium | Dashboard AP/AR mengikutkan dokumen VOID; aging bucket tidak | `finance-dashboard.ts:261` |
| M-14 | Medium | Parser nominal CSV bank merusak format desimal-titik (100×); tanpa batas ukuran | `src/actions/finance-bank.ts:144` |
| M-15 | Medium | `matchBankStatementLine` tanpa validasi apa pun | `src/actions/finance-bank.ts:160` |
| M-16 | Medium | Cek keseimbangan di editor jurnal memakai float — jurnal valid tak bisa diposting | `journal-editor-client.tsx:228` |
| M-17 | Medium | `createFinanceJournalDraft` tidak mengecek period lock | `finance-journals.ts:71-87` |
| M-18 | Medium | MIME lampiran dipercaya dari klien (tanpa cek magic bytes) | `finance-line-attachments.ts:35` |
| M-19 | Medium | File lampiran yatim saat draf/baris dihapus dan saat wipe demo | `finance-journals.ts:343-354` |
| M-20 | Medium | Cascade laten: hapus bill/invoice ikut menghapus riwayat pembayaran | `prisma/schema.prisma:1797,1836` |
| M-21 | Medium | Audit trail tidak lengkap: tanpa `postedById`, lock di-upsert menimpa jejak asli | `finance-journals.ts:455`, `finance-period-lock.ts:31` |
| L-01 | Low | Transisi status spend request bukan compare-and-set | `src/actions/finance-spend.ts:42-112` |
| L-02 | Low | Reversal terblokir bila periode asal terkunci; overpay tetap berstatus PAID | `finance-journals.ts:642`, `:527` |
| L-03 | Low | Total neraca/trial balance dihitung ulang di klien dengan float; selisih sen tak terlihat di display | `reports-client.tsx:458`, `finance-money.ts:97` |
| L-04 | Low | Perolehan aset tetap tidak dijurnal otomatis — register bisa drift dari ledger | `src/actions/finance-assets.ts:28-46` |
| L-05 | Low | Neraca per-brand memang tidak seimbang secara matematis — tanpa penjelasan di UI | `src/actions/finance-reports.ts:100` |
| L-06 | Low | COGS calculator parsing float naif (display-only) | `cogs-calculator.tsx:11-18` |
| L-07 | Low | `deleteFinanceFxRate` hard delete tanpa guard & jejak | `src/actions/finance-fx.ts:52` |
| L-08 | Low | Budget line bisa duplikat (tanpa unique constraint & tanpa cek saat create) | `src/actions/finance-budget.ts:40-42` |
| L-09 | Low | Route lampiran mengembalikan 500 alih-alih 401/403 | `api/finance/line-attachments/[id]/route.ts:15` |
| L-10 | Low | Seed membuat user demo ber-password tetap (di luar finance, risiko bila kena DB produksi) | `prisma/seed.ts:32` |

Status verifikasi: **C-01, H-01…H-09, M-14, M-15**, kondisi render tombol wipe, dan L-08 diverifikasi ulang langsung oleh auditor utama terhadap kode sumber; temuan lain berasal dari jalur audit khusus dengan kutipan kode persis.

---

## Temuan Critical

### C-01 — Tombol "Bersihkan" menghapus SELURUH data finance produksi, tanpa gate lingkungan, tanpa flag demo, tanpa audit trail

- **Lokasi:** `src/actions/finance-demo.ts:11-31`; dipicu `src/components/finance/finance-clear-demo-button.tsx:14-22`; dirender tanpa syarat di `src/app/(dashboard)/finance/page.tsx:146`.
- **Penjelasan:** `clearAllFinanceDemoData()` menjalankan `deleteMany()` tanpa filter pada 14 tabel finance — termasuk jurnal POSTED dan data dalam periode terkunci (`FinancePeriodLock` tidak dicek). Satu-satunya guard adalah `requireFinance()`. Tidak ada cek `NODE_ENV`/`ALLOW_DEMO_DATA`, tidak ada kolom `isDemo` di tabel finance mana pun (data demo dan riil tercampur), konfirmasi hanya `window.confirm` satu klik di sisi klien, dan tidak ada log siapa yang menghapus. Jalur ini aktif di produksi apa pun nilai env Railway — satu akun FINANCE (atau sesi yang dibajak) dapat memusnahkan seluruh pembukuan.
- **Bukti:**
  ```ts
  // finance-demo.ts:11-31
  export async function clearAllFinanceDemoData() {
    await requireFinance();
    await prisma.$transaction(async (tx) => {
      await tx.bankStatementLine.deleteMany();
      await tx.bankStatementImport.deleteMany();
      await tx.financeApPayment.deleteMany();
      // ... 8 tabel lain ...
      await tx.financeJournalEntry.deleteMany();
      await tx.financeBankAccount.deleteMany();
      await tx.financeFxRate.deleteMany();
      await tx.financeLedgerAccount.deleteMany();
    });
  ```
  ```tsx
  // finance/page.tsx:146 — tanpa kondisi env/role tambahan
  <FinanceClearDemoButton />
  ```
- **Usulan perbaikan:** (a) hard-fail di produksi: `if (process.env.NODE_ENV === "production" && process.env.FINANCE_DEMO_RESET !== "true") throw`; (b) jangan render tombol di produksi; (c) bila tetap dibutuhkan, wajibkan konfirmasi ketik-ulang frasa + batasi ke role lebih tinggi + tolak bila ada period lock aktif + catat audit; (d) bersihkan juga file `uploads/finance/` (lihat M-19).

---

## Temuan High

### H-01 — Baris jurnal POSTED bisa diedit lewat `upsertFinanceJournalLine` (`lineId` tidak diverifikasi milik `entryId`)

- **Lokasi:** `src/actions/finance-journals.ts:162-168` (cek status) vs `:268-274` (update).
- **Penjelasan:** Status DRAFT dicek pada entry dari `data.entryId`, tetapi update baris dilakukan `where: { id: data.lineId }` tanpa memverifikasi baris itu milik entry tersebut. Pemanggil yang mengirim `entryId` draf miliknya + `lineId` milik jurnal POSTED akan lolos cek status dan bisa mengubah `accountId`/`debitBase`/`creditBase` jurnal terposting — merusak integritas double-entry (tidak ada CHECK constraint DB yang menahan, lihat M-02) sekaligus mem-bypass period lock (dicek pada tanggal entry draf, bukan entry pemilik baris).
- **Bukti:**
  ```ts
  // :162-167 — status dicek pada data.entryId
  const entry = await prisma.financeJournalEntry.findUniqueOrThrow({
    where: { id: data.entryId },
  });
  if (entry.status !== "DRAFT") { throw new Error("Jurnal sudah diposting. ..."); }
  // :268-273 — tapi update tidak mengikat entryId
  const updated = await tx.financeJournalLine.update({
    where: { id: data.lineId },
    data: baseLineData,
  ```
  Bandingkan `deleteFinanceJournalLine` (`:329-337`) yang benar: memuat line lalu mengecek status entry pemiliknya.
- **Usulan perbaikan:** `tx.financeJournalLine.updateMany({ where: { id: data.lineId, entryId: data.entryId }, ... })` dan throw bila `count === 0`; atau muat line dan verifikasi `line.entryId === data.entryId`.

### H-02 — Nominal `NaN`/negatif lolos semua validasi; bill ber-amount NaN membuka pembayaran tanpa batas

- **Lokasi:** `src/lib/finance-money.ts:5-11` (`toDecimal`); `src/actions/finance-ap-ar.ts:85,100,162-165`; `finance-journals.ts:170-177,385-386`; `finance-spend.ts:19`; `finance-assets.ts` (cost/salvage).
- **Penjelasan:** `toDecimal("NaN")` menghasilkan `Decimal(NaN)` (decimal.js menerima string "NaN"; `normalizeNumericString` meneruskannya apa adanya) dan Postgres `numeric` juga menyimpan NaN. Semua perbandingan NaN mengembalikan `false`, sehingga guard `amt.lte(0)` (lolos), `amt.gt(remaining)` (lolos), `debit.gt(0) && credit.gt(0)` (lolos), `debit.lte(0) && credit.lte(0)` (lolos) semuanya tembus. Konsekuensi terburuk: bill dibuat dengan `amount = "NaN"` → `remaining = NaN` → `recordApBillPayment` menerima pembayaran berapa pun, berkali-kali, dan tiap kali memposting jurnal uang keluar bank riil; status tidak pernah PAID. Baris jurnal NaN yang tersimpan juga meracuni seluruh laporan (P&L, neraca, trial balance) menjadi NaN. Kasus terpisah dengan akar sama: nilai **negatif** juga lolos (`debit="-5", credit="10"` → kedua guard false) karena tidak ada cek `>= 0` di aplikasi maupun DB.
- **Bukti:**
  ```ts
  // finance-money.ts:5-11 — tidak menolak non-finite
  export function toDecimal(value: string | number): Prisma.Decimal {
    if (typeof value === "number") return new Prisma.Decimal(value);
    const normalized = normalizeNumericString(value);
    return new Prisma.Decimal(normalized || "0");
  }
  // finance-ap-ar.ts:162-165 — NaN lolos kedua guard
  const amt = toDecimal(data.amount);
  const remaining = bill.amount.minus(paidBefore);
  if (amt.lte(0)) throw new Error("Nominal harus positif.");
  if (amt.gt(remaining)) throw new Error("Melebihi sisa hutang.");
  ```
- **Usulan perbaikan:** Tolak non-finite dan batas tanda di satu tempat — `toDecimal` melempar bila `!result.isFinite()`, plus skema zod uang bersama (`z.string().refine(s => { const d = toDecimal(s); return d.isFinite() && d.gte(0); })`) yang dipakai semua field amount finance; tambah CHECK constraint DB `>= 0` (lihat M-02).

### H-03 — `recordApBillPayment` / `recordArInvoicePayment` tidak atomik — race overpayment & data setengah jadi

- **Lokasi:** `src/actions/finance-ap-ar.ts:150-216` (AP) dan `:230-296` (AR).
- **Penjelasan:** Cek sisa hutang, pembuatan jurnal (`createPostedFinanceJournal` — bertransaksi sendiri), `financeApPayment.create`, dan update status bill adalah 4 operasi terpisah tanpa satu `$transaction` pembungkus. (a) Dua pembayaran bersamaan pada bill sama membaca `paidBefore` yang sama → keduanya lolos `amt.gt(remaining)` → overpayment + dua payment record. (b) Crash setelah jurnal terposting tapi sebelum `financeApPayment.create` → GL mencatat uang keluar tetapi bill tetap OPEN tanpa payment → bisa dibayar dua kali.
- **Bukti:**
  ```ts
  // finance-ap-ar.ts — empat operasi terpisah
  const bill = await prisma.financeApBill.findUniqueOrThrow({...});   // :150
  if (amt.gt(remaining)) throw new Error("Melebihi sisa hutang.");     // :165
  const journalId = await createPostedFinanceJournal({...});           // :174
  await prisma.financeApPayment.create({...});                         // :196
  await prisma.financeApBill.update({ where: { id: bill.id }, data: { status } }); // :211
  ```
- **Usulan perbaikan:** Refactor `createPostedFinanceJournal` agar menerima `tx`, bungkus seluruh alur dalam satu `prisma.$transaction`, dan kunci baris bill (`SELECT ... FOR UPDATE` via `$queryRaw`) sebelum menghitung `remaining` — atau isolasi `Serializable` + retry.

### H-04 — `recordFinanceSpendPayout`: double payout pada double-submit

- **Lokasi:** `src/actions/finance-spend.ts:125-181`.
- **Penjelasan:** Guard `req.payoutEntryId` dibaca di luar transaksi; jurnal payout dibuat; lalu status di-update dengan `update({ where: { id } })` biasa (bukan compare-and-set). Dua request bersamaan sama-sama melihat `status=APPROVED, payoutEntryId=null` → dua jurnal payout terposting (uang keluar dobel di GL); update terakhir menimpa `payoutEntryId` sehingga jurnal pertama jadi yatim namun tetap tercatat.
- **Bukti:**
  ```ts
  if (req.payoutEntryId) { throw new Error("Pengajuan ini sudah dibayar."); } // :132 — di luar tx
  const journalId = await createPostedFinanceJournal({...});                  // :153
  await prisma.financeSpendRequest.update({ where: { id: req.id },
    data: { status: FinanceSpendRequestStatus.PAID, payoutEntryId: journalId } }); // :175-180
  ```
- **Usulan perbaikan:** Dalam satu transaksi: `updateMany({ where: { id, status: "APPROVED", payoutEntryId: null }, data: { status: "PAID", payoutEntryId } })` dan batalkan jurnal bila `count === 0`; tambah `@unique` pada `payoutEntryId`.

### H-05 — Reversal bisa dibuat dua kali: guard di luar transaksi, tanpa unique constraint

- **Lokasi:** `src/actions/finance-journals.ts:624-645`; `prisma/schema.prisma:1587-1599`.
- **Penjelasan:** Cek `target.reversedBy.length > 0` (baris 635) dilakukan di luar `$transaction` (baris 645); transaksi hanya membungkus pembuatan entry pembalik. Dua permintaan reverse bersamaan sama-sama lolos → dua jurnal pembalik terposting, saldo terpengaruh dobel. Di schema `reversesEntryId` hanya `@@index`, bukan `@unique`, jadi DB tidak menahan duplikat.
- **Bukti:**
  ```ts
  if (target.reversedBy.length > 0) { throw new Error(...); }  // :635 — di luar tx
  const reversed = await prisma.$transaction(async (tx) => {    // :645
    const entryNumber = await nextJournalNumber(tx, reversalDate);
    return tx.financeJournalEntry.create({ ... reversesEntryId: target.id, ... });
  ```
- **Usulan perbaikan:** `reversesEntryId String? @unique` (additive; perlu cek data existing dulu) + pindahkan guard ke dalam transaksi.

### H-06 — Reversal tidak menyinkronkan sub-ledger AP/AR & spend — GL dan sub-ledger divergen

- **Lokasi:** `src/actions/finance-journals.ts:645-675`.
- **Penjelasan:** `reverseFinanceJournal` hanya menyalin lines dengan debit↔kredit ditukar. Bila jurnal asal (via posting ber-link) membuat `FinanceApBill`/`FinanceArInvoice` (CREATE_BILL/CREATE_INVOICE) atau payment + status PAID (PAY_BILL/RECEIVE_INVOICE), reversal tidak membatalkan dokumen-dokumen itu: bill/invoice tetap OPEN/PAID, payment tetap ada, spend request tetap PAID. Komentar schema (`schema.prisma:1657-1659`) menyiratkan niat penelusuran `createdBillId/createdInvoiceId` saat reverse, tetapi tidak ada kode yang melakukannya. Akibatnya akun kontrol 2000/1200 di GL tidak lagi cocok dengan aging sub-ledger setelah reversal.
- **Bukti:** fungsi hanya membuat entry + lines mirror (`:659-671`); tidak ada satu pun akses ke `financeApBill`/`financeApPayment`/`financeArPayment`/`financeSpendRequest` di dalamnya.
- **Usulan perbaikan:** Saat reverse, telusuri `lines.link` jurnal asal dalam transaksi yang sama: void bill/invoice hasil CREATE_* (bila belum berpayment), hapus/kontra payment hasil PAY_*/RECEIVE_* lalu hitung ulang status OPEN/PARTIAL/PAID, dan kembalikan spend request PAID → APPROVED bila payout entry-nya dibalik.

### H-07 — Saldo Kas & Bank dashboard memakai `openingBalance` non-ledger → drift terhadap neraca/trial balance

- **Lokasi:** `src/lib/finance-dashboard.ts:126-150`; `src/actions/finance-bank.ts:31-47`.
- **Penjelasan:** KPI kas dashboard = Σ `FinanceBankAccount.openingBalance` + mutasi ledger akun `tracksCashflow`. Saldo awal ini tidak pernah dijurnal (`createFinanceBankAccount` hanya menulis tabel bank), sementara neraca/trial balance/GL menghitung kas murni dari jurnal. Angka kas dashboard ≠ kas neraca sebesar total `openingBalance`; bila user juga menjurnal saldo awal manual (praktik lazim), dashboard menghitung dobel.
- **Bukti:**
  ```ts
  // finance-dashboard.ts:144-149
  for (const r of openingRows) total = total.plus(r.openingBalance);
  total = total.plus(toDecimal(mutationAgg._sum.debitBase))
               .minus(toDecimal(mutationAgg._sum.creditBase));
  ```
- **Usulan perbaikan:** Saat membuat rekening, generate jurnal saldo awal (debit akun bank, kredit ekuitas saldo awal) dan hapus penjumlahan `openingBalance` dari dashboard; atau minimal beri disclaimer + alat rekonsiliasi.

### H-08 — Bill/Invoice dapat dibuat langsung di sub-ledger tanpa jurnal — aging drift dari akun kontrol

- **Lokasi:** `src/actions/finance-ap-ar.ts:90-107` (`createFinanceApBill`), `:120-137` (`createFinanceArInvoice`).
- **Penjelasan:** Kedua fungsi membuat dokumen sub-ledger tanpa jurnal ke akun kontrol, sedangkan jalur editor jurnal (link CREATE_BILL/CREATE_INVOICE) mensyaratkan baris ledger. Dashboard menghitung AP/AR dari tabel bill/invoice; neraca menghitung "Hutang/Piutang usaha" dari akun kontrol. Kedua angka berbeda persis sebesar dokumen yang dibuat lewat jalur langsung — dan pembayarannya kelak (H-03) menjurnal sisi bank/AP tanpa pernah ada pengakuan hutang awal.
- **Bukti:** `prisma.financeApBill.create({ data: { ... amount: toDecimal(data.amount), status: OPEN ... } })` (`:93-105`) — tidak ada pemanggilan jurnal; bandingkan `recordApBillPayment` (`:174-194`) yang menjurnal.
- **Usulan perbaikan:** Buat jurnal otomatis saat create (beban/pendapatan vs akun kontrol), atau tutup jalur create langsung dan arahkan lewat editor jurnal ber-link.

### H-09 — API AI (`/api/ai/*`): default role `CEO` bila env kosong; satu token bersama tanpa scope per-klien

- **Lokasi:** `src/lib/ai-api/auth.ts:30-44`; `src/lib/ai-api/guard.ts`; `mcp-server/src/index.ts:91`.
- **Penjelasan:** Seluruh 72 endpoint `/api/ai/*` memakai satu bearer token `AI_READ_API_TOKEN`. Role efektif ditentukan `AI_READ_API_ROLE` — dan bila tidak diset/invalid, default `"CEO"`, yang lolos `canViewFinanceSummary`/`canViewFinancePending` (baca ringkasan finance, aging AP/AR, budget vs actual, approval pending). Artinya: (a) integrasi non-finance tidak bisa diberi token tanpa akses finance (role global tunggal, bukan per key); (b) bila `AI_READ_API_ALLOW_ROLE_HEADER=true`, klien dapat mengeskalasi diri ke `ALL` via header `x-dcc-role`.
- **Bukti:**
  ```ts
  // auth.ts:31-35
  const configured = process.env.AI_READ_API_ROLE?.trim().toUpperCase();
  const base: AiApiRole =
    configured && VALID_ROLES.has(configured as AiApiRole)
      ? (configured as AiApiRole)
      : "CEO";
  ```
- **Usulan perbaikan:** Default paling-rendah (mis. `STUDIO`) atau tolak request (503) bila `AI_READ_API_ROLE` tidak diset; jangka menengah: token per-klien dengan scope tersimpan di DB. Verifikasi nilai env di Railway (lihat bagian Perlu Verifikasi Manual).

### H-10 — Deploy DB berbasis `prisma db push` tanpa riwayat migrasi

- **Lokasi:** `package.json:15-16`; folder `prisma/` (tidak ada `migrations/`).
- **Penjelasan:** `db:migrate` = `"npm run db:evolve-kanban && prisma db push"`, `db:deploy` = `"npm run db:diff && npm run db:evolve-kanban && prisma db push && npm run db:backfill-kanban"`. Flag `--accept-data-loss` memang sudah dihapus (commit `3e6a133`) — bagus — tetapi `db push` tetap tanpa riwayat migrasi, tanpa rollback, dan tanpa review SQL sebelum eksekusi; perubahan destruktif hanya tertahan oleh prompt interaktif Prisma. `guard-destructive.ts` hanya dipasang di `db:clear-projects`, tidak di `db:deploy`. Tidak ada CHECK constraint versi-terkontrol yang mungkin didefinisikan (terkait M-02). Sesuai aturan keras audit ini, workflow deploy harus berbasis `prisma migrate` yang ter-review.
- **Bukti:**
  ```json
  "db:migrate": "npm run db:evolve-kanban && prisma db push",
  "db:deploy": "npm run db:diff && npm run db:evolve-kanban && prisma db push && npm run db:backfill-kanban",
  ```
- **Usulan perbaikan:** Baseline `prisma migrate` dari schema saat ini (`prisma migrate diff` → migration awal ber-`migration_lock`), lalu `db:deploy` → `prisma migrate deploy`; otomatiskan `db:backup` sebagai langkah pertama `db:deploy`; pasang guard host remote juga pada `db:deploy`.

### H-11 — Nol test untuk seluruh modul Finance

- **Lokasi:** `vitest.config.ts:7` (`include: ["src/**/*.test.ts"]`); 30 file test yang ada semuanya milik research/SEO/scraper.
- **Penjelasan:** Tidak ada satu pun test untuk: validasi balance posting, period lock, FX, sub-ledger AP/AR (overpayment, PARTIAL/PAID), reversal, depresiasi, laporan (P&L/neraca/arus kas/trial balance), state machine spend request, rekonsiliasi bank/parser CSV, dan util uang (`toDecimal`). Banyak di antaranya logika murni yang bisa diuji tanpa DB (`finance-money.ts`, `finance-trial-balance.ts`, `finance-journal-number.ts`, `finance-cashflow.ts`).
- **Usulan perbaikan:** Mulai dari unit test murni (money/normalisasi — sekaligus mengunci perbaikan H-02 dan M-14), lalu test aksi posting/reversal/period-lock dengan DB test lokal. Setiap PR FASE 2 wajib membawa test untuk temuannya (sesuai aturan keras #5).

### H-12 — Unlock periode = hard delete record kunci, tanpa jejak, dengan role yang sama dengan lock

- **Lokasi:** `src/actions/finance-period-lock.ts:53-62`; juga `:31-44` (lock via `upsert`).
- **Penjelasan:** `unlockFinancePeriod` menghapus baris `FinancePeriodLock` via `deleteMany` — riwayat "siapa mengunci, kapan, alasan" ikut lenyap dan tidak ada catatan siapa membuka. Skenario manipulasi tak terdeteksi: unlock → ubah/posting jurnal backdate → lock lagi (`upsert` menimpa `lockedById/lockedAt` asli). Semua user FINANCE bisa melakukannya; tidak ada pemisahan kewenangan untuk membuka buku yang sudah ditutup.
- **Bukti:**
  ```ts
  await prisma.financePeriodLock.deleteMany({
    where: { year: data.year, month: data.month },
  });
  ```
- **Usulan perbaikan:** Soft-unlock (kolom `unlockedAt`/`unlockedById`, atau tabel event lock/unlock append-only); pertimbangkan role lebih tinggi/persetujuan kedua untuk unlock.

---

## Temuan Medium

### M-01 — Double-post `postFinanceJournal` hanya dicegah "kebetulan" oleh unique `entryNumber`

- **Lokasi:** `src/actions/finance-journals.ts:426-462`.
- **Penjelasan:** Cek status DRAFT memang di dalam `$transaction` (bagus), tetapi pada isolasi default READ COMMITTED dua transaksi bersamaan bisa sama-sama membaca `status="DRAFT"`, dan update-nya tidak berkondisi status. Keduanya lanjut mem-materialisasi sub-ledger (PAY_BILL → dua payment). Yang menyelamatkan hanyalah keduanya menghasilkan `entryNumber` identik sehingga transaksi kedua gagal di unique index — proteksi implisit yang rapuh (rusak bila draft kelak sudah punya nomor, atau format nomor berubah; perhatikan `:454` `entry.entryNumber ?? (await nextJournalNumber(...))`).
- **Usulan perbaikan:** CAS eksplisit: `updateMany({ where: { id: entryId, status: "DRAFT" }, data: { status: "POSTED", ... } })`, throw bila `count === 0`, sebelum materialisasi sub-ledger.

### M-02 — Tidak ada penegakan debit=kredit / non-negatif di level database

- **Lokasi:** `prisma/schema.prisma:1621-1648`; tidak ada folder `prisma/migrations`.
- **Penjelasan:** Keseimbangan hanya dijaga aplikasi (`:399-401`, `:448-451` — untungnya memakai `Prisma.Decimal`, bukan float). Tidak ada CHECK constraint apa pun (grep `CHECK (` nihil; workflow `db push` tidak menyimpan constraint kustom). Kombinasi dengan H-01/H-02 berarti DB bisa menyimpan jurnal terposting yang tidak seimbang atau bernilai NaN/negatif tanpa penahan apa pun.
- **Usulan perbaikan:** Migration SQL additive: `CHECK ("debitBase" >= 0 AND "creditBase" >= 0 AND NOT ("debitBase" > 0 AND "creditBase" > 0))` per baris; keseimbangan per-entry via deferrable constraint trigger, atau minimal job verifikasi trial balance berkala + alert.

### M-03 — `nextJournalNumber` rawan race; gagal P2002 tanpa retry; batas `padStart(6)`

- **Lokasi:** `src/lib/finance-journal-number.ts:18-31`.
- **Penjelasan:** Pola read-max-then-increment tanpa lock: dua posting bersamaan membaca `last` sama → nomor identik → transaksi kedua gagal unique violation dengan error Prisma mentah ke user (tidak ada retry di pemanggil). Edge tambahan: di atas 999999, ordering string `orderBy: { entryNumber: "desc" }` salah secara leksikografis → nomor macet/duplikat.
- **Usulan perbaikan:** Tabel counter per tahun dengan `UPDATE ... RETURNING` (row lock alami) atau Postgres sequence; minimal retry-on-P2002.

### M-04 — `ensurePeriodOpen` memakai client global (bukan `tx`) dan sering dipanggil di luar transaksi

- **Lokasi:** `src/lib/finance-period-lock.ts:9-29`; pemanggil `finance-journals.ts:378` (sebelum tx), `:440` (dalam callback tx tapi query lewat `prisma` global → koneksi lain), `:642-643` (reversal, di luar tx).
- **Penjelasan:** Antara cek dan commit posting, `lockFinancePeriod` bisa berjalan → jurnal masuk periode yang baru dikunci. Window kecil, tapi perbaikannya murah.
- **Usulan perbaikan:** `ensurePeriodOpen(date, tx?)` yang memakai `tx` bila ada; panggil di dalam transaksi posting/reversal.

### M-05 — PAY_BILL/RECEIVE_INVOICE saat posting: cek sisa tanpa row-lock → overpay pada posting paralel

- **Lokasi:** `src/actions/finance-journals.ts:505-533` (AP), `:569-597` (AR).
- **Penjelasan:** Jalur ini sudah dalam `$transaction` (lebih baik dari H-03), tetapi di READ COMMITTED dua transaksi paralel yang melunasi bill sama sama-sama membaca `payments` sebelum commit lawannya → keduanya lolos `amount.gt(remaining)`.
- **Usulan perbaikan:** `SELECT ... FOR UPDATE` pada bill/invoice via `tx.$queryRaw` sebelum menghitung `remaining`, atau isolasi `Serializable` + retry.

### M-06 — Depresiasi bulanan tidak idempoten; akumulasi di-update di luar transaksi; input year tanpa batas

- **Lokasi:** `src/actions/finance-assets.ts:60-63, 68-151`.
- **Penjelasan:** (a) Tidak ada cek "bulan ini sudah diposting" — `reference: DEP-YYYY-MM` tidak unik; menjalankan dua kali menggandakan beban depresiasi. (b) Jurnal dibuat via `createPostedFinanceJournal` (transaksi sendiri) lalu `accumulatedDepreciation` di-update per aset setelahnya dengan pola read-then-write di luar transaksi — crash di tengah → jurnal ada tapi akumulasi tidak ter-update → over-depresiasi bulan berikutnya. (c) `year: z.number().int()` tanpa min/max. (d) Bonus: nilai `monthly` untuk register tidak dibulatkan sedangkan jurnal memakai `toFixed(2)` — dua pembulatan independen.
- **Usulan perbaikan:** Satu `$transaction` untuk jurnal + `increment` akumulasi; guard unik `(year, month)` untuk run depresiasi; `year` dibatasi (mis. 2000–2200).

### M-07 — Ganti tanggal draf tidak menghitung ulang konversi FX → `debitBase` & `fxRateSnapshot` basi

- **Lokasi:** `src/actions/finance-journals.ts:105-128` (`updateFinanceJournalHeader`) vs `:228-248` (konversi FX per baris).
- **Penjelasan:** Konversi `amountForeign × rate` dan snapshot ditentukan `entry.entryDate` saat baris disimpan; mengubah tanggal header tidak menyentuh baris, dan posting tidak memvalidasi ulang. Jurnal FX bisa terposting dengan kurs tanggal lama. Serupa bila kurs di-update in-place (`upsertFinanceFxRate`) setelah baris draf dibuat. Catatan: editor jurnal saat ini belum mengekspos field currency, jadi risiko bersifat laten tetapi action-nya menerima `currencyCode` dari pemanggil mana pun.
- **Usulan perbaikan:** Saat tanggal header berubah, hitung ulang semua baris non-IDR (atau tolak bila ada baris FX); validasi ulang snapshot saat posting.

### M-08 — `createPostedFinanceJournal` memvalidasi keseimbangan SEBELUM pembulatan per-baris

- **Lokasi:** `src/actions/finance-journals.ts:380-417`; kolom `Decimal(18,2)` di `schema.prisma:1628-1629`.
- **Penjelasan:** `debitSum.equals(creditSum)` dihitung dari input mentah (bisa >2 dp), lalu tiap baris dibulatkan Postgres per-baris secara independen. Input `0.005 + 0.005` vs `0.01` lolos validasi tetapi tersimpan `0.01 + 0.01` vs `0.01` → jurnal POSTED tidak seimbang. Kontras dengan `postFinanceJournal` (`:442-451`) yang menjumlah nilai pasca-pembulatan DB (benar). Semua caller internal saat ini memakai `toFixed(2)` sehingga laten.
- **Usulan perbaikan:** `toDecimalPlaces(2)` per baris sebelum menjumlah dan menyimpan.

### M-09 — Hasil kali FX tidak dibulatkan eksplisit; jurnal FX selisih 1 sen terblokir tanpa akun selisih pembulatan

- **Lokasi:** `src/actions/finance-journals.ts:240-247`, `:448-451`.
- **Penjelasan:** `foreignAmt.mul(rate)` (hingga 8 dp) disimpan apa adanya; pembulatan diserahkan implisit ke kolom `Decimal(18,2)`. Karena posting memvalidasi pasca-pembulatan, integritas terjaga — tetapi jurnal multi-baris FX yang selisih 1 sen akibat pembulatan per-baris akan selalu gagal posting, dan tidak ada mekanisme akun "selisih kurs/pembulatan". UI menampilkan angka tanpa desimal sehingga user melihat dua total "identik" yang ditolak.
- **Usulan perbaikan:** Bulatkan eksplisit `toDecimalPlaces(2)` + baris otomatis selisih pembulatan bila |debit−kredit| ≤ ambang.

### M-10 — Timezone campur UTC dan lokal server; draf baru memakai timestamp penuh

- **Lokasi:** `src/app/(dashboard)/finance/reports/page.tsx:33-34`; `src/lib/finance-dashboard.ts:17-23`; `src/actions/finance-reports.ts:19-23`; `src/lib/finance-period-lock.ts:9-16`; `src/actions/finance-journals.ts:89-96`.
- **Penjelasan:** `from` diparse UTC-midnight tapi `to` waktu lokal dalam satu fungsi; `endOfDay` memakai `setHours` lokal; `periodBounds` memakai `new Date(year, month-1, 1)` lokal; period lock membaca `getFullYear()/getMonth()` lokal; dan `redirectNewFinanceJournal` membuat draf `entryDate: new Date()` (timestamp penuh) — transaksi dini-hari WIB tanggal 1 tersimpan sebagai akhir bulan sebelumnya di UTC → masuk periode salah di laporan dan kena/lolos period lock yang keliru. Konsisten hanya bila server berjalan di UTC.
- **Usulan perbaikan:** Normalisasi `entryDate` ke tanggal murni UTC (00:00Z) di semua jalur tulis; bangun rentang periode dengan `Date.UTC(...)` di semua jalur baca.

### M-11 — Kolom pembanding neraca salah cut-off untuk asOf tanggal 29–31 (`setMonth` rollover)

- **Lokasi:** `src/actions/finance-reports.ts:336-337`.
- **Penjelasan:** Untuk asOf 31 Juli, `setMonth(getMonth()-1)` menghasilkan "31 Juni" yang di-rollover JS menjadi 1 Juli — kolom "Sebelumnya" memakai cut-off awal bulan yang sama, bukan akhir bulan lalu.
- **Usulan perbaikan:** `new Date(asOf.getFullYear(), asOf.getMonth(), 0)` (hari terakhir bulan sebelumnya) — atau varian UTC-nya selaras M-10.

### M-12 — Definisi arus kas dashboard ≠ laporan arus kas (transfer internal dihitung gross vs di-skip)

- **Lokasi:** `src/lib/finance-dashboard.ts:83-118` vs `src/lib/finance-cashflow.ts:141-148` vs `src/actions/finance-reports.ts:150-185`.
- **Penjelasan:** KPI inflow/outflow dashboard menghitung per-baris (transfer antar bank tercatat di kedua sisi), sedangkan `buildCashFlowStatement` melewatkan entry dengan delta kas nol. Net sama, tetapi angka inflow/outflow berbeda setiap ada transfer internal — tampak seperti bug data bagi user.
- **Usulan perbaikan:** Samakan definisi (exclude entry ber-delta-nol di query dashboard) atau label eksplisit "termasuk transfer internal". Cek juga `reportCashFlow` (`:150-185`) yang tampaknya varian lama tak terpakai — kandidat penghapusan (perlu konfirmasi).

### M-13 — Dashboard AP/AR mengikutkan dokumen VOID; aging bucket hanya OPEN/PARTIAL

- **Lokasi:** `src/lib/finance-dashboard.ts:260-262, 268-270` vs `src/actions/finance-ap-ar.ts:302-306`.
- **Penjelasan:** `where: { status: { not: PAID } }` mengikutkan VOID ke total/alert AP-AR, sementara `financeApAgingBuckets` memakai `status: { in: [OPEN, PARTIAL] }` — dua tampilan aging memberi total berbeda begitu ada dokumen VOID.
- **Usulan perbaikan:** Samakan ke `in: [OPEN, PARTIAL]`.

### M-14 — Parser nominal CSV bank menghapus SEMUA titik → nominal desimal-titik membengkak 100×; tanpa batas ukuran input

- **Lokasi:** `src/actions/finance-bank.ts:144-153`; `:49-53`.
- **Penjelasan:** `"1234.56"` (format US, umum di ekspor bank) → `.replace(/\./g, "")` → `"123456"`. Padahal repo sudah punya `normalizeNumericString` (`finance-money.ts:21-71`) yang menangani heuristik separator dengan benar. Merusak rekonsiliasi (nominal statement tidak akan pernah match). Tambahan: `csvText: z.string().min(1)` tanpa `.max()` — payload sangat besar membebani memori.
- **Bukti:**
  ```ts
  const normalized = s.replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  ```
- **Usulan perbaikan:** Pakai `normalizeNumericString` yang sama; tambah batas ukuran/jumlah baris.

### M-15 — `matchBankStatementLine` tanpa validasi apa pun

- **Lokasi:** `src/actions/finance-bank.ts:160-168`.
- **Penjelasan:** Set `matchedJournalLineId` tanpa cek: entry line berstatus POSTED, akun baris = akun ledger rekening dari import terkait, kecocokan nominal, maupun keunikan (satu journal line bisa di-match ke banyak baris rekening koran — relasi `bankMatches` array tanpa unique). Rekonsiliasi bisa match ke baris draf, akun beban, atau lintas rekening.
- **Usulan perbaikan:** Validasi status POSTED + `journalLine.accountId === import.bankAccount.ledgerAccountId`; pertimbangkan `@unique` pada `matchedJournalLineId` bila kebijakan 1:1.

### M-16 — Cek keseimbangan tombol "Posting" di editor jurnal memakai float murni

- **Lokasi:** `src/app/(dashboard)/finance/journals/[id]/journal-editor-client.tsx:228-236, 936`.
- **Penjelasan:** Total dijumlah `+= Number(...)` lalu tombol dinonaktifkan bila `totalDebit !== totalCredit` (perbandingan float eksak). Baris ber-sen (0.10 + 0.20 vs 0.30) → `0.30000000000000004 !== 0.3` → jurnal yang sebenarnya seimbang (server pakai Decimal) tidak bisa diposting dari UI. Integritas server aman; ini bug fungsional klien.
- **Usulan perbaikan:** Jumlahkan dalam sen-integer, atau bandingkan `Math.abs(d - c) < 0.005`.

### M-17 — `createFinanceJournalDraft` tidak memanggil `ensurePeriodOpen`

- **Lokasi:** `src/actions/finance-journals.ts:71-87`.
- **Penjelasan:** Semua jalur mutasi lain mengecek period lock, tetapi create draf tidak — draf ber-`entryDate` di bulan terkunci bisa dibuat (belum bisa diposting, jadi dampak terbatas, tapi inkonsisten).
- **Usulan perbaikan:** Tambah `await ensurePeriodOpen(data.entryDate)`.

### M-18 — MIME lampiran dipercaya dari klien

- **Lokasi:** `src/actions/finance-line-attachments.ts:35-39`; disajikan `api/finance/line-attachments/[id]/route.ts:46-48`.
- **Penjelasan:** `file.type` (mudah dipalsukan) satu-satunya cek tipe; disimpan dan dipakai sebagai `Content-Type` respons. Mitigasi sudah ada (whitelist mime, batas 10MB, `nosniff`, `Content-Disposition: inline`, file di luar `public/`), sehingga risiko sisa kecil — file berbahaya berlabel image/pdf tersimpan.
- **Usulan perbaikan:** Verifikasi magic bytes (JPEG/PNG/PDF) sebelum simpan.

### M-19 — File lampiran yatim saat draf/baris dihapus dan saat wipe demo

- **Lokasi:** `src/actions/finance-journals.ts:329-354`; `schema.prisma:1710` (attachment `onDelete: Cascade`); util hapus file hanya dipanggil di `finance-line-attachments.ts:98`.
- **Penjelasan:** Hapus draf/baris menghapus row attachment via cascade tanpa memanggil `removeFinanceAttachment()` — file struk/invoice tetap di `uploads/finance/<entryId>/` (tidak bocor publik, tapi data sensitif tertinggal + disk membengkak). `clearAllFinanceDemoData` juga tidak menyentuh file.
- **Usulan perbaikan:** Hapus file per-attachment (atau direktori entry) sebelum delete; job pembersih file yatim.

### M-20 — Cascade laten: hapus bill/invoice akan menghapus riwayat pembayaran, sementara jurnalnya tetap ada

- **Lokasi:** `prisma/schema.prisma:1797` (`FinanceApPayment.bill onDelete: Cascade`), `:1836` (AR).
- **Penjelasan:** Saat ini tidak ada action delete bill/invoice (risiko laten), tetapi begitu ada (fitur baru, Prisma Studio, SQL manual), payment history lenyap via cascade sementara journal entry pembayaran (Restrict) tetap ada → GL vs sub-ledger tidak bisa direkonstruksi.
- **Usulan perbaikan:** Ubah ke `onDelete: Restrict` + status VOID sebagai soft delete (additive).

### M-21 — Audit trail tidak lengkap: tanpa `postedById`; lock di-upsert menimpa jejak asli; tidak ada tabel audit finance

- **Lokasi:** `src/actions/finance-journals.ts:455-462`; `finance-period-lock.ts:31-44`; schema (tidak ada model audit-log finance).
- **Penjelasan:** Posting hanya mencatat `postedAt` — pembuat draf belum tentu pem-posting. `lockFinancePeriod` memakai `upsert` yang menimpa `lockedById/lockedAt` asli. Tidak ada audit log untuk edit draf, void, unlock (H-12), atau penghapusan. Yang sudah ada: `createdById`, `recordedById` (payment), `decidedById/At` (spend), `uploadedById` (attachment).
- **Usulan perbaikan:** Kolom `postedById` (additive); tabel `FinanceAuditEvent` append-only untuk aksi sensitif (post, reverse, lock/unlock, delete draf, wipe).

---

## Temuan Low

### L-01 — Transisi status spend request bukan compare-and-set
`src/actions/finance-spend.ts:42-112` — `submit/approve/reject` pola read-status-lalu-update tanpa kondisi status di `where`. Race approve-vs-reject: penulis terakhir menang tanpa jejak. **Fix:** `updateMany({ where: { id, status: "SUBMITTED" }, ... })`.

### L-02 — Reversal terblokir bila periode ASAL terkunci; overpay tetap berstatus PAID
`finance-journals.ts:642-643` — `ensurePeriodOpen(target.entryDate)` membuat entry di periode terkunci tidak bisa dibalik sama sekali, meski tanggal reversal di periode terbuka — koreksi pasca tutup buku jadi mustahil tanpa unlock (bertentangan dengan tujuan reversing entry). Juga `:527-529`: `paidAfter.gte(bill.amount)` menandai PAID saat overpay terjadi (M-05), menyembunyikan kelebihan. **Fix:** cukup kunci tanggal reversal (keputusan kebijakan — dokumentasikan); tampilkan overpay eksplisit.

### L-03 — Total neraca/trial balance dihitung ulang di klien dengan float; selisih sen tak terlihat
`reports-client.tsx:458-462, 845-847, 217-218` — badge "Aktiva = Kewajiban + Ekuitas" hasil hitung float klien dengan toleransi 0.5, bukan jaminan struktural; formatter (`finance-money.ts:97-105`, `maximumFractionDigits: 0`) membuat trial balance selisih 0.01 menampilkan dua total "identik" dengan badge "Tidak seimbang!". **Fix:** hitung total & `isBalanced` di server dengan Decimal (seperti `finance-trial-balance.ts:119` yang sudah benar); saat tidak seimbang tampilkan selisih eksak 2 dp.

### L-04 — Perolehan aset tetap tidak dijurnal otomatis
`src/actions/finance-assets.ts:28-46` — `createFinanceFixedAsset` hanya menulis register; nilai aset register vs akun aset neraca bisa drift sejak awal. **Fix:** jurnal perolehan otomatis atau alat rekonsiliasi register-vs-ledger.

### L-05 — Neraca per-brand secara matematis memang tidak seimbang, tanpa penjelasan di UI
`finance-reports.ts:100-103` — filter `brandId` memotong sebagian baris entry; identitas A = L + E tidak berlaku per segmen dan UI akan menampilkan "Tidak seimbang" yang sebenarnya ekspektasi. **Fix:** dokumentasikan/nonaktifkan badge saat filter brand aktif.

### L-06 — COGS calculator parsing float naif
`cogs-calculator.tsx:11-18` — `Number(hpp.replace(/\./g, "")...)`: input "125000.50" terbaca 12.500.050. Display-only (tidak ke DB), tapi bisa menyesatkan keputusan harga. **Fix:** pakai `normalizeNumericString`.

### L-07 — `deleteFinanceFxRate` hard delete tanpa guard & jejak
`finance-fx.ts:52-56` — kurs bisa dihapus tanpa cek pemakaian/audit. Dampak historis kecil (ada `fxRateSnapshot` per baris), tapi mengubah konversi entri baru tanpa jejak. **Fix:** audit/penonaktifan alih-alih delete.

### L-08 — Budget line bisa duplikat
`finance-budget.ts:40-42` + `schema.prisma:1859` — jalur create tidak mengecek kombinasi `(year, month, brandId, accountId)` dan schema hanya `@@index([year, month])` — double-submit menghasilkan dua baris limit untuk sel yang sama. **Fix:** unique constraint parsial/normalisasi null + upsert sejati.

### L-09 — Route lampiran mengembalikan 500 alih-alih 401/403
`api/finance/line-attachments/[id]/route.ts:15-17` — `requireFinance()` melempar `Error` yang tidak ditangani route handler. Auth-nya benar (non-finance tetap ditolak), hanya kode status salah. **Fix:** try/catch → 401/403.

### L-10 — Seed membuat user demo ber-password tetap (catatan di luar cakupan finance)
`prisma/seed.ts:32` — `db:seed` tanpa gate lingkungan membuat user (mis. `admin@dominatus.local`) berpassword tetap `"dcc-demo-2026"`. Seed tidak menyentuh tabel finance, tetapi bila pernah dijalankan ke DB produksi, akun ini adalah pintu masuk. **Fix:** gate seed dari produksi; verifikasi user demo tidak ada di produksi.

---

## Hal yang Sudah Baik

- **Uang berbasis `Decimal(18,2)`/`Decimal(18,6)`** di seluruh schema; aritmetika server 100% `Prisma.Decimal` (`finance-money.ts`) — tidak ada penjumlahan saldo float di server; validasi balance memakai `debitSum.equals(creditSum)`.
- **Jurnal POSTED immutable lewat jalur normal**: edit/hapus ditolak di semua mutasi draf; koreksi via reversing entry (`reversesEntryId`), sesuai best practice — kecuali celah H-01.
- **`entryNumber` sekuensial dibuat saat posting** (draf tidak menyita nomor) dengan `@unique` di DB.
- **Filter `status: POSTED` konsisten** di semua laporan inti, GL, trial balance, budget, dan dashboard — tidak ada laporan yang menghitung draf.
- **Period lock ditegakkan luas**: posting, reversal (dua tanggal), edit header (tanggal lama & baru), upsert/delete baris, hapus draf, lampiran.
- **Otorisasi terpusat & konsisten**: 14/14 file action finance memanggil `requireFinance()` di tiap exported action; role enum Prisma via helper tunggal; middleware/proxy + guard server-component ganda untuk rute `/finance`.
- **Guard `/api/ai/*` seragam di 72/72 route**: bearer token dibandingkan constant-time (`timingSafeEqual`); role ditetapkan server-side; endpoint finance digate `canViewFinanceSummary/Pending` — kecuali kelemahan default H-09.
- **Tidak ada mass assignment**: semua create/update memetakan field eksplisit (tidak ada spread input ke Prisma).
- **Segregation of duties spend**: requester ≠ approver ≠ pembayar.
- **Lampiran aman dari path traversal**: disimpan di luar `public/`, resolusi path dinormalisasi & dibatasi root, di-stream lewat route ber-guard dengan `nosniff`.
- **Guard overpayment ada di semua jalur pembayaran** (meski rawan race — H-03/M-05) dan status PARTIAL/PAID otomatis.
- **Praktik DB membaik**: `--accept-data-loss` sudah dihapus (commit `3e6a133`), `guard-destructive.ts` ketat (remote butuh `FORCE_DESTRUCTIVE_DB=1`), `backup-db.ts` memakai `pg_dump --format=custom` dan gagal keras dengan bersih.
- **Soft delete di tempat yang tepat**: akun (`isActive`), aset (`disposedAt`); `onDelete: Restrict` di relasi kritis (akun←baris jurnal, jurnal←payment).

---

## Perlu Verifikasi Manual (di luar jangkauan audit read-only)

1. **Env Railway aktual**: `AI_READ_API_ROLE`, `AI_READ_API_ALLOW_ROLE_HEADER`, `ALLOW_DEMO_DATA`, `NODE_ENV`, `TZ` (banyak temuan timezone jinak bila server UTC), `FORCE_DESTRUCTIVE_DB`.
2. **CHECK constraint di DB produksi**: schema repo tidak mendefinisikannya, tapi constraint manual langsung di DB tidak terlihat dari repo (`\d "FinanceJournalLine"`).
3. **Apakah `db:seed` pernah menyentuh DB produksi** (cek keberadaan `admin@dominatus.local` dkk. — L-10).
4. **Deteksi kerusakan yang mungkin sudah terjadi**: query dua entry dengan `reference` `DEP-YYYY-MM` sama (depresiasi dobel, M-06); entry dengan >1 pembalik (`reversesEntryId` duplikat, H-05); jurnal POSTED tidak seimbang (H-01/M-08); nilai NaN/negatif di `FinanceJournalLine`/`FinanceApBill` (H-02) — sebelum memasang unique/CHECK constraint baru.
5. **Isolation level DB** (analisis race mengasumsikan default READ COMMITTED) dan timeout interactive transaction Prisma (default 5 detik) untuk posting berjumlah baris besar.
6. **Fitur FX di UI**: editor jurnal belum mengekspos field currency — konfirmasi apakah memang belum diluncurkan (menentukan urgensi M-07/M-09).
7. **`reportCashFlow`** (`finance-reports.ts:150-185`) tampak dead code — konfirmasi sebelum dihapus.
8. **Siapa saja pemegang role FINANCE di produksi** (satu-satunya penghalang C-01 saat ini) dan apakah backup `db:backup` rutin dijalankan sebelum deploy.

---

## Ringkasan Eksekutif

1. Fondasi modul finance tergolong sehat: uang memakai Decimal, jurnal POSTED immutable dengan koreksi via reversal, period lock luas, otorisasi terpusat `requireFinance()`, dan tidak ada mass assignment.
2. Namun ada **satu temuan Critical**: tombol "Bersihkan" di dashboard menghapus seluruh 14 tabel finance produksi hanya bermodal role FINANCE — tanpa gate environment, tanpa jejak.
3. Kluster High pertama adalah **integritas ledger**: baris jurnal POSTED bisa diedit lewat celah `lineId` (H-01) dan nominal `NaN` menembus semua guard hingga memungkinkan pembayaran tanpa batas (H-02).
4. Kluster High kedua adalah **atomisitas**: pembayaran AP/AR, payout spend, dan reversal berjalan tanpa transaksi/CAS yang benar — double-submit atau crash menghasilkan uang keluar dobel atau data setengah jadi (H-03, H-04, H-05).
5. Kluster High ketiga adalah **konsistensi GL vs sub-ledger/dashboard**: reversal tidak membatalkan bill/payment (H-06), saldo awal bank tidak dijurnal (H-07), dan bill/invoice bisa lahir tanpa jurnal (H-08) — angka dashboard dan neraca akan divergen.
6. Sisi tata kelola: API AI default ke role CEO bila env kosong (H-09), deploy DB masih `prisma db push` tanpa riwayat migrasi (H-10), tidak ada satu pun test finance (H-11), dan unlock periode menghapus jejak (H-12).
7. Temuan Medium terbanyak soal race condition tersisa, pembulatan/timezone, dan parser CSV bank yang merusak nominal format US 100× (M-14).
8. Tidak ada perubahan schema destruktif yang dibutuhkan: semua perbaikan yang diusulkan bersifat additive (kolom nullable, unique/CHECK constraint baru, tabel audit baru).
9. Sebelum memasang constraint baru, jalankan query deteksi kerusakan-yang-sudah-terjadi (bagian Perlu Verifikasi Manual butir 4) di salinan/backup — bukan di DB produksi langsung.
10. Rekomendasi: kerjakan FASE 2 sesuai urutan prioritas di bawah, satu branch/PR kecil per topik, masing-masing dengan test.

## Urutan Prioritas Perbaikan

1. **P0 — C-01**: gate/hapus `clearAllFinanceDemoData` dari produksi (perubahan kecil, risiko terbesar).
2. **P0 — H-02**: `toDecimal` menolak non-finite + skema zod uang bersama (menutup pembayaran-tanpa-batas; prasyarat banyak fix lain).
3. **P0 — H-01**: ikat `lineId` ke `entryId` di `upsertFinanceJournalLine`.
4. **P1 — H-03, H-04, H-05, M-01, M-05**: satu paket "atomisitas & CAS" — refactor `createPostedFinanceJournal` menerima `tx`, CAS di posting/payout/reversal, `@unique reversesEntryId` & `payoutEntryId`, row-lock bill/invoice.
5. **P1 — H-12 + M-21**: audit trail (soft-unlock, `postedById`, tabel audit event).
6. **P1 — H-10**: baseline `prisma migrate` + `DEPLOY-CHECKLIST.md` (deliverable FASE 2) — dikerjakan awal karena PR-PR lain akan butuh migration ter-review (unique/CHECK constraint).
7. **P2 — H-06, H-07, H-08**: konsistensi GL vs sub-ledger (reversal sinkron, jurnal saldo awal bank, jurnal otomatis bill/invoice).
8. **P2 — H-09**: default role API AI paling-rendah + verifikasi env Railway.
9. **P2 — H-11**: fondasi test finance (money/trial-balance/journal-number dulu, sejalan dengan tiap PR fix).
10. **P3 — M-02 … M-21** sesuai kluster (constraint DB, depresiasi idempoten, timezone/pembulatan, CSV bank, lampiran), lalu **P4 — semua Low**.

---

*Laporan ini dihasilkan pada FASE 1 (audit read-only). Tidak ada kode aplikasi, schema, maupun data yang diubah. Menunggu review dan persetujuan item-per-item sebelum FASE 2.*
