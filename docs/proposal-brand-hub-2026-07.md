# Proposal Revamp Brand & Creative Hub — Fokus: Output yang Benar-Benar Berguna

_Audit 15 Juli 2026 (revisi ke-2). Fokus revisi: kenapa output fitur-fitur Brand Hub tidak membantu pekerjaan nyata Brand Manager & Creative Director, dan output seperti apa yang seharusnya dihasilkan._

## Akar masalah: kenapa output terasa tidak berguna / tidak production-ready

### 1. AI-nya kenal pasar, tapi tidak kenal brand Anda sendiri

Semua generator (strategi, guideline, audience) di-ground hanya dengan data pasar hasil scrape — review kompetitor, Pinterest, ads, trend — plus satu kolom teks `pmBrief`. Sistem hampir tidak tahu apa-apa tentang brand-nya sendiri:

- Model `Brand` cuma punya `name`, `logo`, `colorCode` (`prisma/schema.prisma:484-488`). Tidak ada kategori, positioning saat ini, price tier, klaim utama, larangan brand, atau identitas eksisting.
- Katalog produk nyata (`Product` — SKU, kategori, stok) **tidak pernah dibaca** Brand Hub; Portfolio-nya input manual terpisah.
- Evidence yang dipakai malah **org-wide**, bukan per brand — strategi brand A bisa dibangun dari data brand B.

Akibatnya output-nya boilerplate konsultan yang "bisa untuk brand mana saja". Brand Manager yang hafal brand-nya sendiri langsung merasa: *ini generik, tidak berguna*.

### 2. Bentuk output-nya abstraksi, bukan work product

Yang dihasilkan modul sekarang vs yang sebenarnya dibutuhkan kedua persona sehari-hari:

| Modul | Output sekarang | Kenapa tidak membantu |
|---|---|---|
| Brand Strategy | Prosa purpose/essence/STP/tone + action plan | Dokumen referensi sekali baca; action plan-nya (bagian paling berguna) buntu — tidak jadi task/brief apa pun |
| Creative Guideline | Hex palette hasil agregasi thumbnail scrape + nama Google Font + moodboard pilihan AI + ringkasan 2-3 kalimat | Terlalu dangkal untuk jadi brand book (tanpa logo usage, rasio warna, skala tipografi, photography direction, do/don'ts), dan terlalu abstrak untuk jadi arahan campaign |
| Audience | Persona AI dari data pasar generik | Tanpa data internal, tidak bisa diedit, dan tidak dikonsumsi fitur lain |
| Visual Trend | Frekuensi tag + palet dominan + prosa brief | Analitik dangkal; tidak menjawab "lalu desain kita bagaimana" |
| Ad Library | Daftar ad kompetitor + winning score + ringkasan | Berhenti di "ad ini bagus" — tidak pernah sampai "kita bikin versi kita begini" |
| Competitor / Social (proxy) | Data mentah Research Hub | Insight tanpa "so what" untuk brand |
| Review/Keyword/USP/Trend brand-native | Duplikat pipeline Research Hub di tabel terpisah | Membingungkan (dua versi kebenaran), tidak menambah nilai |

Yang **tidak ada** padahal itulah pekerjaan harian mereka:
- **Brand Manager**: campaign/marketing brief, messaging house untuk copywriter, laporan brand bulanan, respon konkret atas gerakan kompetitor.
- **Creative Director**: creative brief per campaign/launch (objective, insight, key message, mandatories, referensi, daftar deliverable + spec per channel), brand book yang layak dipakai, moodboard yang bisa dikurasi.

### 3. Output-nya "take it or regenerate" — tidak ada jalur manusia

- Creative Guideline & Audience **tidak punya aksi edit sama sekali** (`src/actions/brand-creative-guideline.ts`, `brand-audience.ts` — hanya create/regenerate/delete). Hasil AI 80% benar? 20% yang salah tidak bisa diperbaiki → dibuang semua.
- Moodboard hanya grid tampilan; tidak bisa tambah/hapus/susun/anotasi.
- Tidak ada status kurasi manusia — READY berarti "AI selesai", bukan "sudah disetujui manusia".

### 4. Output tidak pergi ke mana-mana

Action plan tidak bisa jadi task. Guideline & Audience tidak dikonsumsi Content Studio (grounding hanya baca strategi + review + ad hooks + trend — `src/lib/content-studio/grounding.ts:238-272`). Ekspor hanya PDF client-side sederhana. Tidak ada share ke tim.

### 5. (Pendukung) Fondasi teknis ikut menggerus kepercayaan

Job AI via `after()` tanpa queue/reaper → dokumen macet permanen di GENERATING; halaman Review Intelligence bisa hang s/d 10 menit (resume job di render path); angka overview membaca tabel berbeda dari halaman modul; output LLM tidak divalidasi struktur. Detail di revisi proposal sebelumnya — tetap perlu dibereskan sebagai baseline.

---

## Proposal: 4 paket + 1 baseline

### Paket 1 — Brand Foundation: buat AI kenal brand Anda (prasyarat kualitas)

1. **Modul & model baru `BrandProfile`** — diisi sekali, dipakai semua generator: kategori & sub-kategori, positioning saat ini, price tier, target market, klaim utama & bukti, nilai/larangan brand (mis. halal, vegan, no-alcohol), kompetitor utama, tone eksisting, aset identitas resmi (logo & warna resmi dari `Brand`, tagline).
2. **Sambungkan katalog produk nyata** — hero product & lini diambil dari model `Product` (bukan input manual duplikat); Portfolio jadi lapisan strategi di atas katalog nyata.
3. **Evidence per brand** — semua evidence gathering & gate difilter brand/kategori; peringatan eksplisit bila evidence lintas kategori.
4. **Konsolidasi modul duplikat** — Review/Keyword/USP/Trend brand-native dijadikan proxy Research Hub (seperti Competitor & Social sekarang); Brand Hub berhenti menduplikasi riset dan fokus ke deliverable.

> Dampak: output berhenti generik karena setiap prompt membawa fakta brand + evidence yang relevan saja.

### Paket 2 — Deliverable baru: output berbentuk alat kerja

**Untuk Brand Manager:**

1. **Campaign Brief Generator** — pilih tujuan (launch / promo / awareness) + produk dari katalog → draf brief lengkap: objective & KPI, insight konsumen (dikutip dari review/social nyata), key message (dari strategi), penawaran, channel plan, referensi ad kompetitor yang terbukti menang (dari Ad Library). Editable → bisa diturunkan jadi task & Creative Brief.
2. **Messaging House / Copy Bank** — per produk: klaim + bukti, hook yang terbukti (dari ad & review), kata yang dipakai konsumen, do/don't kata. Format siap tempel untuk copywriter.
3. **Competitor Response Digest** — alert kompetitor bukan cuma "harga berubah", tapi rekomendasi respon konkret (pakai struktur `ActionPlan` yang sudah ada: owner, prioritas, impact) + tombol jadikan task.
4. **Laporan Brand Bulanan** — satu dokumen ringkas (sentimen, SOV, gerakan kompetitor, trend relevan, progress action plan) — siap dilaporkan ke CEO.

**Untuk Creative Director:**

5. **Creative Brief Generator** — diturunkan dari Campaign Brief + Guideline: arah visual & mood, referensi terkurasi (subset Visual Library), mandatories (logo, warna, klaim wajib), tone, daftar deliverable per channel lengkap dengan spec ukuran. Editable & assignable.
6. **Brand Book yang sesungguhnya** — upgrade Creative Guideline jadi dokumen berbagian: logo usage (dari aset resmi), palet resmi + rasio penggunaan (60/30/10), skala tipografi konkret (size/weight/line-height, bukan cuma nama font), photography/art direction dengan contoh visual, layout do/don'ts. AI mengisi draf per bagian; manusia mengedit per bagian; export PDF kualitas presentasi.
7. **Ad Teardown yang actionable** — dari "winning score" menjadi "kenapa menang" (hook, format, durasi, angle) + aksi "buat versi kita" yang menghasilkan draf Creative Brief.

### Paket 3 — Human-in-the-loop: semua output bisa dikoreksi manusia

1. **Edit action untuk Creative Guideline & Audience** (paritas dengan Strategy yang sudah editable).
2. **Regenerate per bagian** di Guideline & deliverable baru (pola `regenerateBrandStrategySection` sudah ada).
3. **Status kurasi manusia** terpisah dari lifecycle AI: `Draf AI → Direview → Dipakai` + siapa & kapan.
4. **Moodboard interaktif**: tambah/hapus/susun ulang/anotasi asset; kurasi tersimpan sebagai keputusan manusia, bukan tertimpa regenerate.

### Paket 4 — Last mile: output mengalir ke eksekusi

1. **Action plan / brief → Task** dengan assignee + due date + link balik ke dokumen sumber.
2. **Content Studio membaca Guideline + Audience + Messaging House** (bukan hanya strategi).
3. **Export & share layak presentasi** — PDF rapi + share link read-only ber-token untuk vendor/tim non-user.
4. **Freshness**: "terakhir diperbarui" di semua modul.

### Paket 0 (baseline teknis, dikerjakan paralel)

Job durable + reaper status macet + retry; keluarkan resume-job dari render path; validasi zod semua output LLM (gagal = FAILED jujur, bukan READY rusak); satu sumber angka overview; `error.tsx`; timeout Apify. Tanpa ini, deliverable sebagus apa pun tetap terasa rusak saat job macet.

---

## Urutan yang saya rekomendasikan

**Paket 0 + Paket 1 dulu** (fondasi teknis + grounding — tanpa ini kualitas output tidak akan berubah), lalu **Paket 2 bertahap** mulai dari dua deliverable dengan dampak tercepat: **Campaign Brief → Creative Brief** (satu alur BM → CD yang langsung kepakai), **Paket 3** menyusul melekat pada tiap deliverable baru, **Paket 4** terakhir.

Kalau mau lebih ramping lagi untuk fase pertama: `Paket 0 + BrandProfile (1.1-1.3) + Campaign/Creative Brief (2.1, 2.5) + edit semua output (3.1)` sudah cukup untuk mengubah persepsi "tidak berguna" → "dipakai tiap campaign".

## Keputusan yang saya butuhkan

1. **Scope fase pertama**: full Paket 0+1 lalu 2, atau versi ramping di atas?
2. **Konsolidasi modul duplikat (1.4)**: setuju Review/Keyword/USP/Trend brand-native dijadikan proxy Research Hub? (Data lama tetap bisa dibaca; yang berhenti adalah duplikasi generate.)
3. **Akses Creative Director**: deliverable untuk CD hanya berguna kalau CD bisa masuk. Minimal yang saya sarankan: NORMAL_USER (custom role Creative Director) bisa view semua + edit modul kreatif (guideline, moodboard, creative brief, visual library); aksi AI berbiaya & delete tetap di PM. Setuju?

Setelah approve, saya susun work order rinci per paket untuk dieksekusi Codex.
