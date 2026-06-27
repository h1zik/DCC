# Prompt untuk Claude Code — Modul "SEO Toolkit" di dalam DCC

> Jalankan Claude Code di root repo DCC, lalu kirim seluruh isi di bawah ini sebagai pesan pertama.

---

## Konteks

Kamu adalah senior Full Stack Developer. Kamu bekerja di dalam **Dominatus Control Center (DCC)** — platform produktivitas internal perusahaan (mirip ClickUp internal): Next.js 16 App Router, React 19, TypeScript 5, Prisma 6 + PostgreSQL, NextAuth v5, Tailwind 4 + shadcn + Base UI. Ini aplikasi internal untuk karyawan, **bukan produk komersial** — jadi tidak perlu multi-tenant, billing, atau onboarding eksternal.

Tugasmu: membangun **modul "SEO Toolkit"** yang lengkap dan kuat sebagai bagian dari DCC, untuk dipakai tim marketing (bisnis kosmetik/skincare B2C, pasar Indonesia). Modul ini melengkapi Research Hub yang sudah ada, bukan menggantinya.

## ATURAN WAJIB — baca sebelum menulis kode

1. **Patuhi `AGENTS.md`**: ini Next.js 16 dengan breaking changes. **Baca panduan relevan di `node_modules/next/dist/docs/` sebelum menulis kode apa pun**, dan ikuti semua deprecation notice. Jangan pakai pola Next.js dari ingatanmu tanpa verifikasi.
2. **Reuse, jangan bikin ulang.** DCC sudah punya banyak hal yang kamu butuhkan. Sebelum membuat apa pun yang baru, telusuri dan pakai yang sudah ada:
   - **DataForSEO** sudah terintegrasi (`DATAFORSEO_LOGIN` / `DATAFORSEO_PASSWORD`) di fitur *Keyword Intel*. Temukan client-nya dan pakai/extend, jangan buat client baru dari nol.
   - **Scraper marketplace** ada di `src/lib/scraper-api/` (Shopee/Tokopedia/Lazada) dengan **Apify** sebagai fallback (`src/lib/apify/`). Pakai ini untuk semua kebutuhan data marketplace.
   - **LLM** memakai abstraksi provider (`RESEARCH_LLM_PROVIDER`: Gemini/Groq/Ollama). Pakai abstraksi yang sudah ada — **jangan tambah Anthropic/OpenAI** atau provider baru.
   - **Research jobs/analyzers/ingest** ada di `src/lib/research/`. Ikuti pola yang sama untuk job SEO.
   - **Export laporan** (PDF/DOCX, citation-backed) sudah ada di Research Reports — pakai pipeline yang sama untuk laporan SEO.
   - **Cron** terotorisasi via `CRON_SECRET` (lihat `src/app/api/cron/...`). Pakai pola ini untuk rank tracking terjadwal.
   - **Web Push** (VAPID, `web-push`) sudah ada — pakai untuk notifikasi perubahan ranking.
   - **MCP server** (`mcp-server/`) mengekspos research tools ke AI agent — daftarkan tools SEO baru di sini.
   - **Auth & roles** (NextAuth v5 + permission) sudah ada — batasi modul SEO ke role marketing/admin.
   - UI: shadcn + Base UI, `lucide-react`, `sonner` (toast), ECharts/Recharts (chart), TipTap (editor), `zod` + `react-hook-form` (validasi/form). Pakai komponen & pola yang sudah dipakai modul lain agar konsisten.

## Yang harus dibangun (fitur SEO Toolkit)

Bangun sebagai sub-modul di dalam dashboard (mis. `src/app/(dashboard)/seo/...` ikuti konvensi routing yang sudah ada). Logika inti di `src/lib/seo/`.

1. **Keyword Research & Clustering** — riset keyword (Indonesia: gunakan location & language code Indonesia di DataForSEO), search volume, difficulty, CPC, related/long-tail, SERP features. Kelompokkan keyword berdasarkan intent. Simpan sebagai "keyword project/list" yang bisa dipakai ulang. Extend *Keyword Intel* yang sudah ada bila relevan.
2. **SERP Rank Tracker** — pengguna menyimpan keyword + URL target → cek posisi di Google ID secara terjadwal (cron harian) → simpan time-series → tampilkan tren posisi, perubahan, dan SERP feature. Kirim web push bila ada perubahan ranking signifikan.
3. **On-Page SEO Audit** — input URL website sendiri → analisis title, meta description, struktur heading (H1–H6), keyword usage, alt text, internal/external link, word count, schema markup, dan readability (Bahasa Indonesia). Hasilkan skor + rekomendasi actionable (pakai LLM provider yang ada). Manfaatkan DataForSEO On-Page API yang sudah tersedia.
4. **Technical SEO Crawler** — crawl satu domain → broken link, redirect chain, status code, duplicate/missing meta & title, masalah sitemap/robots, dan Core Web Vitals (DataForSEO OnPage Lighthouse). Tampilkan daftar isu terurut prioritas.
5. **Backlink Analysis** — pakai DataForSEO Backlinks API: referring domains, anchor text, backlink baru/hilang, dan **backlink gap** vs kompetitor.
6. **Content SEO Optimizer** — terhubung ke editor TipTap: dari keyword target, hasilkan brief/outline artikel SEO → draft (LLM provider yang ada, tone kosmetik, Bahasa Indonesia) → analisis draft yang ada (keyword usage, readability, struktur) dengan skor + saran. Jangan tambah provider LLM baru.
7. **Marketplace SEO** — pakai `src/lib/scraper-api/`: riset keyword marketplace, analisis listing teratas (pola judul, harga, terjual, rating), dan **skor optimasi judul/tag** untuk produk sendiri + rekomendasi. Sambungkan ke data Competitor Tracker bila berguna.
8. **SEO Dashboard & Reports** — halaman ringkasan: kartu metrik (ranking rata-rata, isu teknis, dll) + grafik tren (ECharts/Recharts) + tabel. Laporan SEO yang bisa diekspor PDF/DOCX lewat pipeline Research Reports yang sudah ada.
9. **MCP Tools** — daftarkan tools SEO (mis. `seo.keyword_research`, `seo.rank_check`, `seo.onpage_audit`) di `mcp-server/` mengikuti pola tool yang sudah ada.

## Persyaratan teknis

- **Hemat biaya DataForSEO**: cache hasil (mis. 24 jam untuk keyword/SERP), dan pakai metode *standard/queue* (lebih murah) untuk job terjadwal, *live* hanya saat butuh real-time. Indonesia: set location & language code yang benar.
- **Prisma**: tambah model baru (keyword project, tracked keyword, rank snapshot/time-series, audit result, backlink snapshot, dll) mengikuti konvensi schema yang ada; jalankan `npm run db:push`. Jangan ubah model lain tanpa alasan.
- **Validasi** dengan `zod`, form dengan `react-hook-form`.
- **Error handling** rapi di setiap pemanggilan eksternal (DataForSEO, scraper, LLM) — satu kegagalan tidak boleh menjatuhkan seluruh halaman; pakai retry/backoff yang wajar.
- **Tests**: tulis test Vitest untuk logika inti di `src/lib/seo/`.
- **`.env.example`**: tambahkan variabel baru bila ada (jelaskan singkat). Jangan hardcode kredensial.
- **Konsistensi**: ikuti gaya kode, struktur folder, server actions (`src/actions/`), dan route handlers (`src/app/api/`) yang sudah dipakai modul lain.

## Cara kerja (ikuti urutan ini — JANGAN langsung coding semua)

1. **Fase 0 — Eksplorasi & Rencana.** Baca `AGENTS.md`, `CLAUDE.md`, `README.md`, dan telusuri kode terkait: client DataForSEO, `src/lib/scraper-api/`, `src/lib/research/`, abstraksi LLM provider, pipeline Research Reports, pola cron, dan skema Prisma. Lalu laporkan:
   - apa saja yang sudah ada dan akan kamu pakai ulang (sebutkan path file),
   - usulan model Prisma baru, struktur `src/lib/seo/`, route dashboard, dan daftar endpoint DataForSEO yang dipakai per fitur,
   - rencana bertahap.
   **Berhenti dan tunggu persetujuan saya sebelum menulis kode.**
2. **Fase 1**: Keyword Research & Clustering + SERP Rank Tracker (termasuk cron + time-series + chart + notifikasi).
3. **Fase 2**: On-Page Audit + Technical Crawler.
4. **Fase 3**: Backlink Analysis + Content SEO Optimizer (TipTap + LLM).
5. **Fase 4**: Marketplace SEO + SEO Dashboard ringkasan + Reports + MCP tools.

Di akhir tiap fase: pastikan `npm run lint` dan `npm run test` lulus, jalankan, beri ringkasan singkat apa yang sudah jadi + cara mengaksesnya, lalu **berhenti dan tanya apakah lanjut atau ada revisi**.

Tulis kode yang bersih, ber-tipe penuh, modular, konsisten dengan konvensi DCC, dan beri komentar di bagian yang rumit.

Mulai dari **Fase 0**: eksplorasi dulu, laporkan temuan + rencana, lalu tunggu persetujuan saya.
