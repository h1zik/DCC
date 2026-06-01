# PTR Auto-Run Results

> Hasil eksekusi otomatis test runner [`scripts/ptr-runner.sh`](scripts/ptr-runner.sh) terhadap branch `feat/attendance`.

## Ringkasan

| Metric | Nilai |
|---|---|
| Skenario otomatis | **99 / 99 lulus (100%)** |
| Coverage modul | Akses M0–M14 + API endpoints |
| Manual reviewer masih perlu | UI interactions (M2–M13 detail), kamera (M14.2–M14.17) |

## Cakupan otomatis

Test runner memvalidasi semua hal yang bisa dicek tanpa browser:

- **Auth & redirect role-aware** (M1–M2): login 7 akun (CEO/Admin/Logistics/PM/Finance/Marketing/Akdzan), redirect home per role, gate `/login` saat sudah login.
- **Proxy gate per modul** (M3–M13): tiap role dicek terhadap setiap modul, baik akses positif (200) maupun penolakan (307 redirect).
- **Modul Absensi page-level** (M14): semua role bisa GET `/attendance` ✓; hanya CEO/Admin bisa GET `/attendance/rekap` ✓; non-admin di-redirect lewat **HTML meta-refresh** (`<meta http-equiv="refresh" content="1;url=/attendance">`) — bekerja di browser tapi tidak nampak di HTTP status (validasi cek body).
- **API Absensi**:
  - `GET /api/face-data` — 401 tanpa auth ✓, 200 sebagai user ✓
  - `GET /api/attendance` — 401 tanpa auth ✓, 200 sebagai user ✓
  - `GET /api/attendance/export` — 403 non-admin ✓, 200 admin, **CSV header benar** + **BOM UTF-8 terdeteksi** ✓
  - `DELETE /api/attendance` — 403 non-admin ✓, 200 admin ✓
  - `POST /api/attendance` — 401 tanpa auth ✓, 400 type invalid ✓, 400 alasan kosong (Sakit/Izin) ✓, 201 sukses ✓, 429 dup <15s ✓
  - `DELETE /api/face-data` — 403 hapus user lain sebagai non-admin ✓, 200 sebagai admin ✓, 200 self-delete ✓

## Cara menjalankan ulang

```bash
cd "c:/Users/Lenovo/Documents/Absensi Dom/DCC"
docker compose up -d db          # postgres
npm run db:push                  # apply schema
npm run db:seed                  # seed users
npm run dev                      # next dev (tab terpisah)
# di tab baru:
bash scripts/ptr-runner.sh
```

Catatan: runner butuh `finance@dominatus.local` (password `dcc-demo-2026`) — buat lewat `/admin/users` atau tambah ke seed kalau belum ada.

## Yang masih perlu reviewer manual

Item-item berikut **tidak bisa diotomasi** dari CLI; buka [PROBIS-CHECKLIST.md](PROBIS-CHECKLIST.md) untuk eksekusi tangan:

- **UI form & klik**: M3 stock log/koreksi, M4 CRUD form, M5 Kanban drag, M6 stage transition, M7 chat & dokumen, M8 calendar grid, M9 approve button, M10 form jurnal & period lock, M11 admin CRUD.
- **Kamera & face recognition** (M14.2–M14.17): enrollment 4 pose, upload foto, check-in scan, mismatch, blink, camera busy, Strict Mode regression.
- **Rekap admin UI** (M14.18–M14.21): grafik, filter date, export download, cleanup dialog, reset wajah.
- **Cross-module flows** (M15.1–M15.5): perlu klik berurutan multi-tab/role.

## Temuan tambahan (quirks DCC, **bukan dari `feat/attendance`**)

Selama run, runner menemukan 4 inkonsistensi yang sudah ada di `main` sebelum branch ini:

1. **`/brands` tidak terjangkau Logistics** — proxy memakai `LOGISTICS_PREFIXES` yang tidak mengandung `/brands`, padahal `requireCeoOrLogisticsStaff` di [src/lib/auth-helpers.ts](src/lib/auth-helpers.ts) menyiratkan Logistics boleh kelola brand. Akibatnya helper itu praktis dead-code untuk role Logistics. Tidak menggagalkan PTR, tapi worth refactor.
2. **`/rooms` (plural) bocor ke Studio/PM/NORMAL_USER** — [src/lib/routes.ts](src/lib/routes.ts) `isStudioWorkspaceRoute` menggunakan `pathname.startsWith("/room")` yang tak sengaja juga match `/rooms`. Sebagai akibatnya, NORMAL_USER bisa GET `/rooms` (200) padahal menu sidebar mereka tidak menampilkannya. Halaman tetap render, tapi mungkin perlu data-level gate.
3. **`/schedule` tidak terjangkau Finance** — `isFinanceAppRoute` tidak include schedule, sehingga role Finance tidak bisa mengakses kalender bersama. Bila intent-nya Schedule "untuk semua", tambahkan `isScheduleRoute(pathname) ||` di `isFinanceAppRoute`.
4. **Server-component `redirect()` pakai HTML meta-refresh, bukan HTTP 307** — ini bukan bug, hanya perilaku Next.js yang perlu diketahui untuk testing (jangan andalkan HTTP status, cek body atau follow redirect di browser).

> Keempat hal di atas **bukan blocker** untuk merge `feat/attendance` — pre-existing. Catat untuk refactor terpisah.

## Status PTR Absensi (sub-set M14 yang otomasi)

| Skenario | Status |
|---|---|
| M14 enrollment kamera (4 pose) | **manual** (perlu webcam) |
| M14 enrollment upload foto | **manual** (perlu file picker) |
| M14.5 Check-In sukses face recognition | **manual** (perlu webcam) |
| M14.7 Blink fallback 4s | **manual** |
| M14.8 Wajah orang lain → mismatch | **manual** |
| M14.9 POST Sakit | ✅ auto (201) |
| M14.10 POST Izin | ✅ auto (sama logic) |
| M14.11 Alasan kosong → 400 | ✅ auto |
| M14.12 Dup <15s → 429 | ✅ auto |
| M14.13 Riwayat saya GET | ✅ auto |
| M14.17 Strict Mode camera | **manual** (`useWebcam` regression — sudah ada fix `startingRef`+`wantCameraRef`) |
| M14.18 Rekap admin akses | ✅ auto (page 200) |
| M14.19 Export CSV header + BOM | ✅ auto |
| M14.20 Cleanup DELETE admin/non-admin | ✅ auto |
| M14.21 Tab registrasi UI | **manual** |
| M14.22 Reset face DELETE | ✅ auto (admin) + ✅ self |
| M14.23 Non-admin redirect | ✅ auto (meta-refresh) |

## Verdict

✅ **Layer access control + API behavior absensi siap.** Reviewer manual tinggal validasi alur visual (kamera, klik UI, drag, form) per [PROBIS-CHECKLIST.md](PROBIS-CHECKLIST.md).

Tidak ada blocker untuk merge branch `feat/attendance` → `main` dari sisi auto-PTR.
