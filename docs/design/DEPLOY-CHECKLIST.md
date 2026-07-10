# DEPLOY CHECKLIST — Profil Gamifikasi DCC

> Runbook rilis fitur gamifikasi profil. **Additive, di balik feature flag,
> reversible.** Semua langkah DB aman diulang (idempotent). Lihat design doc:
> `docs/design/profile-gamification-2026-07-08.md`.

---

## 0. Pra-syarat (sebelum deploy)

- [ ] Semua PR fase 2–5 ter-merge; CI hijau: `npm run lint && npm run test && npm run build && npx prisma validate`.
- [ ] Entri changelog ditambahkan.
- [ ] **Backup DB Railway ada & terverifikasi.** Cek snapshot terbaru di dashboard Railway (atau `npm run db:backup`). Jangan lanjut tanpa backup.
- [ ] Env production disiapkan (JANGAN nyalakan flag dulu):
  - `PROFILE_GAMIFICATION_ENABLED` → **belum diset / `false`** (default off).
  - `ATTENDANCE_ONTIME_CUTOFF` → `"09:15"` (jam masuk 09:00 + toleransi 15 mnt); ubah bila kebijakan beda.
  - `CRON_SECRET` → sudah ada (dipakai cron gamifikasi juga).

---

## 1. Migrasi schema (additive)

- [ ] Deploy kode ke Railway.
- [ ] Jalankan **`prisma migrate deploy`** (BUKAN `db push`, BUKAN `--accept-data-loss`).
      Migrasi `20260708045544_gamification_fase1` hanya `CREATE TABLE/TYPE/INDEX` +
      `ALTER TABLE "Task" ADD COLUMN "completedAt"` (nullable) + `ALTER TYPE
      "NotificationType" ADD VALUE`. Tidak menyentuh data existing.
- [ ] Verifikasi: `npx prisma migrate status` → "Database schema is up to date".

## 2. Seed katalog (OTOMATIS saat boot)

- [x] **Tidak perlu langkah manual.** Katalog (cosmetics + achievements) auto-sync
      saat server boot via `src/instrumentation.ts` → `ensureGamificationCatalog()`,
      dijaga hash-versi (`AppBranding.gamificationCatalogVersion`) supaya boot normal
      = no-op dan hanya menulis saat definisi katalog di kode berubah. `upsert` by key,
      idempotent, tak menyentuh data user; kosmetik unggahan admin tak tersentuh.
- [ ] (Opsional) memaksa sync lokal setelah edit katalog: `npm run db:seed-gamification`.
- [ ] Preset gradient banner (Twilight–Candy) di-hard-code di editor (disimpan di
      `User.profileBannerPreset`) — sengaja TIDAK ikut katalog DB.

## 3. Backfill (idempotent, additive)

- [ ] `npm run db:backfill-gamification`. Script mencetak host DB target di awal —
      **pastikan host = DB produksi yang benar**. Untuk tiap user:
  - Seed XP tenure = `cumXp(levelKeanggotaanLama)` → **lantai level** (tak ada yang turun).
  - Rekonsiliasi streak absensi historis dari `Attendance` (read-only).
  - Buka achievement historis (streak/tenure/level) — idempotent, tanpa notifikasi.
- [ ] Verifikasi cepat (contoh via `prisma studio` / query):
  - User lama (mis. "Dzikri" yang dulu Level 3) → `UserProgression.level >= 3` (tidak turun).
  - `XpLedger` punya 1 baris `reason=TENURE` per user (dedupe `tenure:<uid>`).
  - Tak ada XP `TASK_ONTIME` historis (forward-only — sesuai desain).
- [ ] (Opsional) jalankan cron sekali untuk freshness minggu berjalan:
      `curl -H "Authorization: Bearer $CRON_SECRET" https://<app>/api/cron/gamification-sync`
      → jalankan 2× untuk buktikan idempotent (tak ada dobel XP).

## 4. Jadwalkan cron (Railway)

- [ ] Tambah cron harian (mis. 06:00 WIB):
      `GET /api/cron/gamification-sync` header `Authorization: Bearer <CRON_SECRET>`.
      Handler mengembalikan `{skipped:true}` bila flag off — aman dijadwalkan lebih awal.

## 5. Nyalakan bertahap

- [ ] **Cara utama (runtime, tanpa restart):** buka **`/admin/gamification`** (sidebar →
      "Gamifikasi", khusus admin) → nyalakan **toggle**. Flag DB-backed
      (`AppBranding.profileGamificationEnabled`), berlaku di request berikutnya.
- [ ] (Opsional) `PROFILE_GAMIFICATION_ENABLED=true|false` di env = **override darurat**
      yang mengunci toggle (butuh redeploy/restart untuk terbaca).

## 6. Verifikasi pasca-deploy

- [ ] **Regresi nol saat flag off** (uji di staging): profil lama render identik
      (server view-loader mengembalikan `null` → path lama).
- [ ] Flag on: buka `/profile` →
  - [ ] Level besar + XP bar + streak tampil; angka **≥ level keanggotaan lama**.
  - [ ] Etalase + shelf achievement muncul; hidden achievement tampil "???".
  - [ ] Hero background & frame render; **ikut tema** (uji ganti tema di Theme Studio →
        efek WebGL re-color).
  - [ ] **Kontrak performa**: 60fps (DevTools Performance), auto-pause saat scroll
        offscreen / pindah tab, `prefers-reduced-motion` → fallback statis (bukan blank).
- [ ] `/profile/edit` → equip cosmetic yang dimiliki tersimpan & live-preview beranimasi;
      coba equip item **tak dimiliki** via payload → **ditolak server** (401/error).
- [ ] Upload background: file besar → tersimpan `.webp`, EXIF ter-strip, dimensi ≤1600×900,
      URL eksternal ditolak.
- [ ] Absensi: lakukan verified check-in → `XpLedger` + `UserProgression` naik (dedupe
      hari sama tak dobel); achievement `attendance_7` dst. terbuka + notifikasi 🏆.
- [ ] Tutup task sebelum tenggat → `Task.completedAt` terisi, XP `TASK_ONTIME` sekali;
      reopen→reclose tak menambah.
- [ ] Panel metrik admin `/admin/gamification` menampilkan angka adopsi awal.

## 7. Pantau "definisi sukses"

- [ ] Baseline dicatat di hari-0 (adopsi absensi, % task tepat waktu) via `/admin/gamification`.
- [ ] Target: **adopsi absensi 30% → 70% dalam 4 minggu**; % task tepat waktu naik.
- [ ] Bila metrik **tak bergerak** dalam beberapa minggu → **tuning nilai XP/reward** di
      `src/lib/gamification/constants.ts` (bukan biarkan fitur mati nyangkut).

---

## Rollback (bila perlu)

- **Cepat & aman:** set `PROFILE_GAMIFICATION_ENABLED=false` → seluruh fitur mati; profil
  kembali ke tampilan lama. Data gamifikasi tetap tersimpan (tak hilang).
- Schema **tidak** perlu di-rollback (additive; tabel/kolom baru tak mengganggu path lama).
- Cron mengembalikan `{skipped:true}` saat flag off — aman dibiarkan terjadwal.

## Catatan aman

- Backfill & seed **hanya menulis state gamifikasi** (`UserProgression`, `XpLedger`,
  `UserAchievement`, `UserCosmetic`, `UserProfileConfig`, katalog). **Tidak pernah**
  mengubah data absensi/task/finance/chat.
- Level **tak pernah turun**: `max(levelFromXp(xp), levelLama)` ditegakkan di
  `grant.ts` & backfill.
