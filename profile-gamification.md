# BANGUN SISTEM PROFIL GAMIFIKASI DCC (ala Steam)

> Prompt implementasi untuk agent dengan akses repo (Claude Code / Cursor).
> Tujuan: ubah halaman User Profile DCC yang statis menjadi profil ala Steam —
> **level bermakna, achievements, badges, dan kosmetik (background, avatar border,
> nameplate) yang sebagian gratis-custom dan sebagian di-unlock** — plus halaman
> **Edit Profile** yang cakep dan siap mengatur semua kostumisasi itu.

## Konteks
Kamu bekerja di repo DCC (Dominatus Control Center) — Next.js 16 App Router · React 19 ·
TypeScript 5 · **Prisma 6 + PostgreSQL (Railway)** · NextAuth v5 · Tailwind 4 ·
ECharts/Recharts · TipTap · Vitest. Baca `README.md` dan (jika ada) `AGENTS.md`/`CLAUDE.md`
dulu sebelum menulis kode.

Kondisi sekarang: halaman profil sudah menampilkan avatar, nama, tagline, badge role,
"Tentang", **Statistik kerja** (Tugas selesai / aktif / Ruangan / Pesan chat), daftar
Ruangan, Aktivitas terbaru, dan **"Level keanggotaan" yang naik tiap 30 hari aktif**.
Level itu **belum memberi apa-apa** — itu justru celah yang kita isi: level & pencapaian
harus punya *payoff* yang kelihatan di profil.

## Filosofi produk (jangan menyimpang dari ini)
1. **Kosmetik = reward yang selama ini hilang dari sistem level.** Ini bukan fitur hias
   terpisah; ini yang bikin XP/level/streak jadi berarti.
2. **Model HYBRID:** sebagian kosmetik **gratis & bisa di-custom sejak hari 1** (ekspresi
   diri), sebagian **di-unlock** lewat level/achievement (aspirasi). Peta free-vs-earned
   ada di bawah dan **harus berbasis konfigurasi** (kolom `unlockType`), bukan hard-code,
   supaya gampang di-tuning.
3. **Koperatif, bukan kompetitif.** Fokus streak personal + achievement, **tanpa
   leaderboard peringkat antar-user** di fase ini (tim cuma ~8 orang; leaderboard bikin
   yang bawah demotivasi). Boleh ada "team goal" koperatif, bukan ranking.
4. **Reward outcome, bukan aktivitas.** XP dari hal bernilai & terverifikasi (check-in
   absensi terverifikasi wajah, task selesai *tepat waktu*), **bukan** dari jumlah task
   dipindah / jumlah chat. Ini mencegah gaming.
5. **Kosmetik boleh spektakuler — asalkan murni presentasional, aman & berperforma.**
   Animasi TIDAK dibatasi CSS sederhana. Boleh Lottie, efek partikel WebGL/Canvas,
   parallax, foil/holographic shine, frame avatar beranimasi — asalkan (a) **hanya
   kosmetik**, tak ada logika app yang bergantung padanya; (b) tunduk pada **Kontrak
   animasi & performa** (§ di bawah); (c) aset animasi untuk item *earned/katalog*
   **dikurasi kamu** (bukan kode dari user), jadi tak ada risiko XSS. Upload custom tetap
   dibatasi ke format aman (gambar statis / animated-image), divalidasi & disanitasi;
   tak pernah menerima JS / SVG-berscript / CSS mentah dari user.
6. **Tema-agnostic.** DCC sepenuhnya customizable secara tema — **jangan asumsikan warna
   apa pun** (bukan "dark", bukan "gold", bukan apa-apa). Semua UI profil & kosmetik ikut
   **design token / CSS variable tema DCC yang aktif**, dan harus enak di tema terang,
   gelap, maupun custom.

## Aturan keras (berlaku di semua fase)
1. **JANGAN PERNAH** konek ke `DATABASE_URL` produksi. Semua eksekusi hanya ke DB lokal/dev.
2. **DILARANG** `prisma db push --accept-data-loss`. Migration lewat `prisma migrate dev`
   di DB lokal, sertakan SQL untuk kureview.
3. **Perubahan schema ADDITIVE-ONLY:** tambah tabel/kolom nullable-atau-default/index.
   DILARANG drop/rename destruktif atau ubah tipe yang butuh rewrite data. Data absensi,
   task, chat, dan finance itu **RIIL** — logika XP hanya **MEMBACA** sumber itu, tidak
   pernah mengubahnya.
4. **Preservasi data existing:** siapa pun yang sudah punya "Level keanggotaan" (mis.
   Dzikri Level 3) **tidak boleh turun**. Level baru harus ≥ level lama (pakai level lama
   sebagai lantai saat backfill).
5. **Otorisasi server-side:** user hanya bisa mengedit profilnya sendiri dan hanya bisa
   meng-*equip* kosmetik yang benar-benar dimilikinya. Jangan percaya klien. Cek juga
   `/api/ai/*` tidak bocor menulis apa pun.
6. Setiap perubahan disertai test (Vitest) dan lolos:
   `npm run lint && npm run test && npm run build && npx prisma validate`.
7. Semua di balik **feature flag** (`PROFILE_GAMIFICATION_ENABLED`) supaya bisa dirilis
   bertahap dan dimatikan cepat.

---

## Kontrak animasi & performa (wajib untuk semua kosmetik beranimasi)
Kita **memang mengejar efek kelas Steam** — bukan animasi malu-malu. Kebebasan itu ditebus
dengan disiplin performa, bukan dengan membatasi ambisinya.

**Teknologi yang boleh dipakai:**
- **CSS transform/opacity + Framer Motion / GSAP** untuk orkestrasi UI & micro-interaction.
- **Lottie** (vector, ringan) untuk badge, ikon achievement, unlock/level-up celebration,
  frame avatar beranimasi.
- **WebGL / Canvas** (mis. `pixi.js`, `three.js`, `OGL`) untuk background "hidup": partikel,
  aurora/bokeh, parallax, shader shimmer — ini yang bikin profil terasa premium.
- **APNG / animated-WebP** untuk frame avatar / background bergerak ala Steam (aset terkurasi).

**Guardrail wajib (non-negotiable):**
- Animasikan hanya properti **GPU-friendly** (transform, opacity, WebGL) — hindari layout thrash.
- **Lazy-load + code-split** aset & engine berat; jangan blok first paint / TTI halaman.
- **Auto-pause saat tak terlihat:** `IntersectionObserver` (offscreen) + `visibilitychange`
  (tab background) → hentikan RAF/WebGL loop biar tidak buang CPU/baterai.
- **Cap & adaptif:** batasi jumlah partikel & devicePixelRatio; turunkan kualitas / fallback
  statis di perangkat lemah (pantau FPS atau `navigator.hardwareConcurrency`).
- **`prefers-reduced-motion`:** sediakan fallback statis yang tetap cakep (bukan blank).
- Target **60fps** & tidak pernah menahan interaksi. Ukur; kalau nge-lag, degradasi otomatis.

**Keamanan (kenapa animasi kaya tetap aman):** semua efek "berat" hanya untuk item
**earned/katalog yang asetnya kamu kurasi sendiri** — user tidak pernah menyuplai kode
animasi. Jalur upload custom user dibatasi ke **gambar statis / animated-image** yang
divalidasi & di-re-encode; tak ada JS / SVG-berscript / CSS mentah yang dieksekusi.

---

## FASE 1 — EKSPLORASI & DESAIN (read-only, kerjakan sekarang)
Jangan tulis kode implementasi di fase ini. Pahami dulu, lalu ajukan desain untuk review.

Telusuri & petakan:
a. **Model `User` & profil** — field apa saja yang sudah ada (avatar, tagline, about,
   role, level, "join date"). Di mana komponen halaman profil & edit profil sekarang
   (`src/app/(dashboard)/...`, komponen `Profile*`), dan bagaimana level "30 hari aktif"
   dihitung.
b. **Sumber data XP** — dari mana kita bisa MEMBACA (read-only): event absensi terverifikasi
   (face-api), status & due-date task (kanban), kesegaran data modul, pesan chat. Catat
   tabel/relasi persisnya.
c. **Konvensi kode** — pola server action / route handler, validasi zod, upload file
   existing (avatar sudah upload ke mana? reuse pipeline itu), pola i18n/teks UI, dan
   **sistem tema DCC yang fully customizable** (petakan design token / CSS variable-nya —
   profil & kosmetik harus ikut token ini, jangan pernah hardcode warna). Cek juga apakah
   sudah ada engine animasi (Framer Motion/GSAP/Lottie/WebGL) yang bisa direuse.

Output Fase 1: `docs/design/profile-gamification-YYYY-MM-DD.md` berisi:
- Peta file & model yang tersentuh.
- **Rencana schema Prisma** (model baru di bawah, sesuaikan nama field ke konvensi repo).
- **Kurva XP→Level** yang diusulkan + daftar **XP source** dengan aturan anti-gaming.
- **Katalog awal** achievements & cosmetic items (seed).
- **Wireframe** halaman Edit Profile & Profile view (boleh ASCII/deskriptif).
- Rencana migrasi additive + strategi backfill level.
Setelah itu **STOP dan tunggu approval** sebelum Fase 2.

---

## FASE 2 — DATA MODEL & MIGRATION (setelah approve)
Model baru (additive; nama final ikut konvensi repo). Semua katalog **data-driven** lewat
tabel + seed, bukan hard-code.

**Progression**
- `UserProgression` — `userId (unik)`, `xpTotal`, `level`, `attendanceStreak`,
  `longestAttendanceStreak`, `lastCheckinDate`, `updatedAt`.
- `XpLedger` (append-only, audit + idempotensi) — `userId`, `amount`, `reason` (enum:
  `ATTENDANCE`,`TASK_ONTIME`,`DATA_FRESH`,`ACHIEVEMENT`,`TENURE`…), `refType`, `refId`,
  `dedupeKey (unik)`, `createdAt`. **Kunci anti-double-grant:** satu event = satu
  `dedupeKey` unik (mis. `attendance:<userId>:<date>`, `task:<taskId>:ontime`). Reopen→
  reclose task **tidak** memberi XP lagi.

**Achievements**
- `Achievement` (katalog) — `key (unik)`, `name`, `description`, `category`
  (`ATTENDANCE`/`TASK`/`DATA`/`SOCIAL`/`MILESTONE`), `tier`
  (`BRONZE`/`SILVER`/`GOLD`/`PLATINUM`), `icon`, `xpReward`, `criteria (Json)`,
  `unlocksCosmeticKey (nullable)`, `hidden (bool)` (achievement rahasia), `isActive`.
- `UserAchievement` — `userId`, `achievementId`, `progress (int)`, `unlockedAt (nullable)`,
  unik `(userId, achievementId)`.

**Cosmetics**
- `CosmeticItem` (katalog) — `key (unik)`, `name`, `type`
  (`PROFILE_BACKGROUND`/`AVATAR_BORDER`/`NAMEPLATE`/`TITLE`/`ACCENT`), `rarity`,
  `previewRef`, **`unlockType`** (`FREE`/`LEVEL`/`ACHIEVEMENT`/`CUSTOM_UPLOAD`),
  `unlockLevel (nullable)`, `unlockAchievementKey (nullable)`,
  `styleConfig (Json)` — referensi ke **preset animasi terkurasi**, mis.
  `{effect:'aurora-webgl', lottie:'foil-gold', ring:'orbit', intensity:2}` yang di-map ke
  komponen/aset aman; **bukan CSS/JS mentah**. Warna ambil dari **token tema aktif**, bukan
  hardcode. `isActive`.
- `UserCosmetic` (kepemilikan) — `userId`, `cosmeticItemId`, `source`, `acquiredAt`,
  unik `(userId, cosmeticItemId)`.
- `UserProfileConfig` (yang sedang dipakai) — `userId (unik)`, `equippedBackgroundId`,
  `equippedBorderId`, `equippedNameplateId`, `equippedTitleId`, `accentColor`,
  `customBackgroundUrl (nullable)`, `customBorderColor (nullable)`,
  `showcaseAchievementIds (Json array, terurut)`, `updatedAt`.

Sertakan **seed** katalog awal (lihat Fase 3) + migration SQL untuk kureview.

---

## FASE 3 — BACKEND ENGINE (XP, achievement, unlock, equip, upload)

**Kurva level.** `level = f(xpTotal)` via tabel threshold (mis. tiap level butuh XP naik
progresif). Simpan kurva sebagai konstanta terkonfigurasi. **Backfill:** level baru =
`max(levelDariXp, levelLamaKeanggotaan)` supaya tak ada yang turun.

**XP sources (semua idempotent via `dedupeKey`, outcome-based):**
- **Absensi terverifikasi tepat waktu** → +XP, dengan **streak multiplier bertingkat &
  ber-cap** (mis. ×1 → ×1.5 maks). Reset streak kalau bolong. Sumber: event face-api,
  bukan input manual. *(Menyerang langsung adopsi absensi ~30%.)*
- **Task ditutup ≤ due date** → +XP. **Hanya close pertama** yang dihitung. **Tidak ada**
  XP untuk membuat/memindah task (cegah gaming). Overdue-close = 0 XP (tanpa penalti).
- **Kesegaran data modul** (mingguan, mis. finance terekonsiliasi / research ter-update)
  → +XP, dihitung dari timestamp "last updated", bukan jumlah edit.
- **Achievement unlocked** → bonus XP sesuai `xpReward`.
- **Tenure** (turunan level lama) → XP dasar biar tidak ada yang mulai dari nol.

**Achievement engine.** Dua jalur yang saling melengkapi:
1. **Event-driven** — saat event terjadi (check-in, task close), evaluasi criteria terkait.
2. **Cron rekonsiliasi harian** — sapu progress (streak, mingguan) untuk menutup event yang
   terlewat. Gunakan job/cron yang sudah ada di DCC (research cron). Idempotent.
Unlock achievement → tulis `UserAchievement`, grant XP via `XpLedger`, dan bila
`unlocksCosmeticKey` ada → tambah `UserCosmetic`. Kirim **notifikasi** (reuse Web Push /
Fonnte WA yang sudah ada) "🏆 Achievement baru: …".

**Katalog awal (seed) — contoh, silakan lengkapi:**
- Achievements: `attendance_7` "Konsisten" (streak 7), `attendance_30` "Andalan" (30),
  `attendance_100` "Baja" (100); `task_ontime_10` "Penutup", `clean_board` "Papan Bersih"
  (0 overdue 1 minggu), `firefighter` "Pemadam" (bereskan overdue); `data_curator`
  "Kurator"; `founding_member` "Perintis"; +1–2 **hidden** yang jenaka (cocok kultur tim).
- Cosmetics (peta hybrid free↔earned):
  - **FREE (hari 1):** accent color, `customBorderColor` (warna ring avatar bebas),
    tagline & about (sudah ada), **1 slot upload background custom** (moderasi di bawah),
    ~5 background preset + ~5 border preset dasar.
  - **EARNED (`LEVEL`/`ACHIEVEMENT`):** background **beranimasi kelas berat** (partikel
    WebGL aurora/bokeh, parallax, shader shimmer), **frame avatar beranimasi** (glow
    ber-orbit, foil/holographic shine, Lottie), nameplate/banner prestige yang hidup,
    **Title** ("Level 10", "100 Hari", role-flair), dan **slot showcase tambahan**. Ini
    reward paling didambakan — bikin visualnya benar-benar terasa "naik kelas".

**Custom upload (guardrail wajib).** Reuse pipeline upload avatar existing. Validasi:
MIME allowlist (png/jpg/webp), batas ukuran & dimensi, strip EXIF, re-encode server-side,
simpan di path aman/CDN. **Jangan** terima URL eksternal sebagai background (cegah SSRF).
`styleConfig` user hanya boleh memilih dari opsi terbatas yang di-map ke style aman —
**tidak ada CSS/HTML mentah dari user** (cegah XSS/CSS-injection). Pertimbangkan gate
upload di level rendah (mis. ≥ Lv.2) sekadar filter spam, tetap dalam semangat hybrid.

**API/actions:** `getProfile`, `getProfileConfig`, `updateProfileConfig` (validasi
kepemilikan tiap item di server), `listCosmetics` (owned + locked + syarat unlock),
`listAchievements` (unlocked + progress), `uploadCustomBackground`. Semua zod-validated,
role-checked, dan test-covered.

---

## FASE 4 — FRONTEND: Profile view + Edit Profile page

### 4a. Profile view — INI BINTANGNYA (bikin se-"wow" Steam)
Ini halaman yang harus bikin orang *pengen* naik level. Perlakukan sebagai showpiece, bukan
sekadar render data. Utamakan wow-factor di sini lebih dari halaman lain. Render penuh
`UserProfileConfig` yang ter-equip:

- **Hero header sinematik.** Nameplate/banner ter-equip sebagai **layer hidup**: background
  beranimasi (partikel WebGL / parallax / aurora / shader shimmer sesuai `styleConfig`)
  dengan overlay gradasi supaya teks tetap terbaca. Avatar dengan **frame beranimasi**
  (glow berdenyut, cincin ber-orbit, foil shine) + indikator online. Header boleh reaktif
  halus ke gerak kursor (parallax tilt) — tetap dalam kontrak performa.
- **Level & XP sebagai fokus utama.** Angka level besar dengan **count-up** saat load;
  **XP progress bar** yang mengisi mulus (spring physics) ke ambang berikutnya; badge
  **streak absensi** dengan efek nyala/pulse. Saat baru naik level atau unlock sesuatu,
  putar **celebration** sekali (confetti / particle burst / Lottie) — hormati reduced-motion.
- **Showcase ala Steam.** Grid item pilihan dari `showcaseAchievementIds`: achievement
  unggulan dengan **foil/holographic shine on hover** (kayak kartu Steam), badge per tier
  (bronze→platinum) dengan material/kilau berbeda, dan **stat showcase** (mis. "Tugas
  selesai", "Streak 30") sebagai kartu ber-micro-interaction (tilt/flip 3D ringan).
- **Achievement shelf.** Baris achievement terbaru + akses ke galeri penuh (tab Achievements).
- **Pertahankan** section existing (Statistik kerja, Ruangan, Aktivitas terbaru), tapi
  naikkan polish-nya biar senada dengan hero.

Semua efek tunduk pada **Kontrak animasi & performa** (lazy-load, auto-pause saat offscreen/
tab background, fallback reduced-motion) dan **ikut tema DCC yang aktif** — jangan hardcode
warna; efek harus tetap memukau di tema terang, gelap, maupun custom.

### 4b. Edit Profile page (redesign — ini yang diminta cakep & lengkap)
Layout **dua kolom**: kiri = **Live Preview** kartu profil yang update real-time saat
mengedit (seperti Steam/Discord); kanan = editor **bertab**. Ikut **tema DCC yang aktif**
(pakai design token, jangan hardcode warna), responsif (preview pindah ke atas di mobile).
Live Preview harus me-render animasi kosmetik sungguhan (bukan thumbnail statis) supaya user
lihat persis hasilnya. Tab:

1. **Identitas** — display name, tagline, About (pakai TipTap), upload/ganti avatar.
2. **Tampilan** — inti kostumisasi:
   - Grid **Background**: item owned bisa dipilih; item locked tampil **grayscale + gembok
     + tooltip syarat** ("Buka di Level 8" / "Raih 🏆 Papan Bersih") — aspirasi kelihatan.
     Tombol **Upload background custom** (slot free, lewat guardrail Fase 3).
   - Grid **Avatar border/frame**: preset + **color picker** untuk warna custom (free) +
     frame earned yang locked.
   - **Nameplate/banner** tema, **Accent color**, toggle **animasi**.
3. **Showcase** — atur item yang tampil di profil: **drag-to-order** achievement/badge +
   pilih **stat unggulan**. Jumlah slot bertambah seiring level (tampilkan "slot terkunci").
4. **Achievements** — galeri semua achievement (ala halaman achievement Steam): unlocked
   berwarna + tanggal; locked dengan **progress bar** ("18/30 hari"); hidden tampil sebagai
   "???" sampai terbuka.

Interaksi: perubahan tercermin instan di Live Preview; **Simpan/Batal** eksplisit; state
locked tak bisa di-equip (validasi ulang di server). Sertakan empty/loading/error state.

---

## FASE 5 — ROLLOUT & VERIFIKASI
- Di balik `PROFILE_GAMIFICATION_ENABLED`. Nyalakan untuk diri sendiri/tim kecil dulu.
- **Backfill** `UserProgression` untuk user existing (level = lantai level lama, seed XP
  tenure), lalu jalankan rekonsiliasi achievement historis (mis. streak absensi yang sudah
  ada) secara idempotent.
- **Definisi sukses yang dipatok di awal** (taruh di doc): mis. adopsi absensi 30% → 70%
  dalam 4 minggu; % task ditutup tepat waktu naik. Sediakan query/panel kecil untuk memantau.
  Kalau metrik tak bergerak dalam beberapa minggu → tuning nilai XP/reward, jangan biarkan
  fitur mati nyangkut.
- `docs/design/DEPLOY-CHECKLIST.md`: (1) verifikasi backup Railway ada, (2)
  `prisma migrate deploy` (bukan db push), (3) verifikasi pasca-deploy (profil lama tetap
  render, level tidak turun, upload aman, **animasi lolos kontrak performa** — 60fps,
  auto-pause offscreen, fallback reduced-motion — dan **profil ikut tema** yang dipilih user).

## Urutan kerja
Mulai **FASE 1 (read-only)** sekarang: hasilkan design doc + rencana schema + wireframe,
lalu **STOP untuk review**. Bahasa laporan & teks UI: **Indonesia**. Istilah teknis biarkan
English. Jangan bikin satu PR raksasa — pecah per fase / per topik.