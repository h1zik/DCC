# Design Doc — Profil Gamifikasi DCC (ala Steam)

> **Fase:** FASE 1 (Eksplorasi & Desain, read-only). Belum ada kode implementasi.
> **Bahasa:** Indonesia (istilah teknis English). **Tanggal:** 2026-07-08.
> **Status:** Design disetujui; menunggu go-ahead untuk FASE 2 (Data model & migration).
> **Spec sumber:** `profile-gamification.md` (root repo).

---

## Context — kenapa perubahan ini

Halaman profil DCC sudah "Steam-ish" (hero banner bertema, avatar frame, statistik kerja,
ruangan, aktivitas) dan sudah punya **"Level keanggotaan" yang naik tiap 30 hari aktif** —
tapi level itu **tidak memberi apa-apa**. Tidak ada payoff, jadi tidak mendorong perilaku.

Tujuan fitur: ubah level/streak/achievement jadi **berarti** dengan mengikatnya ke
**kosmetik** (background, avatar border/frame, nameplate, title) yang sebagian **gratis &
bisa di-custom sejak hari 1** dan sebagian **di-unlock** lewat level/achievement. XP hanya
diberi untuk **outcome terverifikasi** (absensi wajah tepat waktu, task selesai tepat waktu,
kesegaran data) — bukan aktivitas yang bisa di-game. Target bisnis (dipatok di awal):
adopsi absensi naik & % task tepat waktu naik.

Semua **additive**, di balik **feature flag**, **tidak menyentuh DB produksi**, dan
**ikut token tema DCC yang aktif** (jangan hardcode warna).

---

## Keputusan yang sudah dikonfirmasi (2026-07-08)

1. **Cutoff absensi tepat waktu:** jam masuk **09:00**, **toleransi 15 menit** →
   on-time bila check-in lokal (Asia/Jakarta) **≤ 09:15**. Disimpan sebagai konstanta/env
   `ATTENDANCE_ONTIME_CUTOFF` (default `"09:15"`) yang bisa di-tune. Check-in terverifikasi
   yang **telat tetap dapat XP dasar & tetap menjaga streak** (tanpa penalti); on-time
   mendapat multiplier streak.
2. **Mesin animasi:** tambah **framer-motion + OGL (WebGL) + @lottiefiles/dotlottie-web** —
   semua **lazy-load, code-split, di balik feature flag + toggle animasi** (~65KB, hanya
   dimuat saat efek aktif & terlihat).
3. **Backfill task XP:** **forward-only** — XP "task tepat waktu" hanya dihitung untuk task
   yang ditutup **mulai setelah rilis** (via kolom baru `completedAt`). Streak absensi &
   tenure **tetap** di-backfill penuh.
4. **Preset lama:** **grandfather** 12 background preset + 9 pattern + 12 sticker + 5 frame
   yang sudah ada sebagai **CosmeticItem FREE** ("art" seperti background Steam, palet sendiri).
   Tak ada yang hilang; **chrome UI & semua efek earned baru** tetap ikut token tema, teks
   selalu diberi overlay kontras agar terbaca di tema apa pun.

---

## 1. Peta file & model yang tersentuh

### Sudah ada (di-preserve / di-extend, bukan ditulis ulang)
| Area | File | Peran sekarang |
|---|---|---|
| Model data | `prisma/schema.prisma` | `User` (kolom `profile*` + `image/bio/createdAt/role/employmentType`), `Attendance`, `Task`, `RoomMessage`, `Notification`, `NotificationType` |
| Konstanta kosmetik | `src/lib/profile-appearance.ts` | `PROFILE_BANNER_PRESETS/PATTERNS/STICKERS/AVATAR_FRAMES` + `bannerGradientCss`/`bannerPatternStyle`/`resolveProfileAccent` → di-reuse renderer FREE items |
| Profil view (showpiece) | `src/components/profile/profile-page-view.tsx`, `user-profile-hero.tsx` | Hero + showcase; kartu **"Level keanggotaan"** = `max(1, floor(tenureDays/30)+1)` (baris 425) → **jadi lantai backfill** |
| Stats | `src/lib/profile-showcase.ts` (`getProfileShowcaseData`) | tasksDone/active, rooms, messageCount, recentDone → di-extend dengan level/xp/streak/achievement |
| Edit profil | `src/app/(dashboard)/profile/edit/page.tsx`, `profile-form.tsx` | Studio tampilan bertab + live `PreviewBoard` + `<AppThemePicker>` → di-extend jadi 4 tab |
| Actions profil | `src/actions/profile.ts` | Pola action (`auth()` → own-record → zod → revalidate); avatar upload pipeline |
| Absensi | `src/app/api/attendance/route.ts` | `POST` → `prisma.attendance.create` (integrasi grant XP di sini) |
| Task | `src/actions/tasks.ts` | `moveTask`/`moveTaskStatus`/`updateTask` transisi DONE (tambah `completedAt` + grant XP) |
| Tema | `src/app/globals.css`, `app-themes.css`, `theme-palettes.css`, `src/lib/theme-generator.ts`, `src/components/app-theme-provider.tsx` | Token OKLCH + custom theme (di-sample oleh efek WebGL) |
| Upload | `src/lib/upload-storage.ts`, `src/lib/document-thumbnail.ts` (sharp) | `getUploadPublicDir()` + re-encode webp/strip EXIF → reuse untuk custom background |
| Notifikasi | `src/lib/notify.ts`, `src/lib/notification-link.ts` | `notifyUser(userId, msg, type)` → reuse untuk achievement |
| Cron | `src/app/api/cron/research-sync/route.ts` | Pola `Bearer CRON_SECRET` + `runLogged` → template cron gamifikasi |
| Testing | `vitest.config.ts`, contoh `src/actions/finance-spend.transitions.test.ts` | Prisma di-mock via `vi.hoisted` |
| Seed/backfill | `prisma/seed.ts`, `prisma/scripts/backfill-kanban-hybrid.ts`, `guard-destructive.ts` | Template seed katalog + backfill (guard local-only) |

### Baru (dibuat)
- `src/lib/gamification/` — engine (flag, constants, level curve, grant, attendance/task/freshness XP, achievements, reconcile) + test co-located.
- `src/actions/gamification.ts` — server actions profil/kosmetik/achievement/upload.
- `src/app/api/cron/gamification-sync/route.ts` — cron rekonsiliasi harian.
- `prisma/scripts/seed-gamification.ts` + `prisma/scripts/backfill-gamification.ts`.
- Komponen frontend baru di `src/components/profile/gamification/` (hero XP/level/streak, showcase grid, achievement gallery, live WebGL background, animated frames, celebration) + tab editor baru.

---

## 2. Rencana schema Prisma (additive-only)

Semua katalog **data-driven** (tabel + seed), bukan hardcode. **Tidak ada** drop/rename/
type-rewrite. Kolom baru semua nullable-atau-default. Kolom `User.profile*` lama **tidak
diubah**.

### Enum baru
```prisma
enum XpReason            { ATTENDANCE  TASK_ONTIME  DATA_FRESH  ACHIEVEMENT  TENURE }
enum AchievementCategory { ATTENDANCE  TASK  DATA  SOCIAL  MILESTONE }
enum AchievementTier     { BRONZE  SILVER  GOLD  PLATINUM }
enum CosmeticType        { PROFILE_BACKGROUND  AVATAR_BORDER  NAMEPLATE  TITLE  ACCENT }
enum CosmeticRarity      { COMMON  RARE  EPIC  LEGENDARY }
enum CosmeticUnlockType  { FREE  LEVEL  ACHIEVEMENT  CUSTOM_UPLOAD }
enum CosmeticSource      { DEFAULT  LEVEL  ACHIEVEMENT  UPLOAD }
// tambah 1 member ke enum existing (additive):
enum NotificationType    { /* ...existing... */  ACHIEVEMENT_UNLOCKED }
```

### Kolom tambahan pada model existing
```prisma
model Task {
  // ...existing...
  /** Waktu tugas PERTAMA kali menjadi DONE. Ditulis oleh domain Task (tasks.ts),
   *  hanya DIBACA XP engine. Nullable + additive; task lama = null. */
  completedAt DateTime?
}
```
Back-relation di `User` (blok relasi): `progression UserProgression?`, `xpLedger XpLedger[]`,
`achievements UserAchievement[]`, `cosmetics UserCosmetic[]`, `profileConfig UserProfileConfig?`.

### Model baru
```prisma
model UserProgression {
  id                      String   @id @default(cuid())
  userId                  String   @unique
  user                    User     @relation(fields:[userId], references:[id], onDelete:Cascade)
  xpTotal                 Int      @default(0)
  level                   Int      @default(1)
  attendanceStreak        Int      @default(0)
  longestAttendanceStreak Int      @default(0)
  lastCheckinDate         String?  // "YYYY-MM-DD" Asia/Jakarta (samakan dgn Attendance.date)
  createdAt               DateTime @default(now())
  updatedAt               DateTime @updatedAt
  @@index([level]) @@index([xpTotal])
}

model XpLedger {                    // append-only: audit + idempotensi
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields:[userId], references:[id], onDelete:Cascade)
  amount    Int
  reason    XpReason
  refType   String?  @db.VarChar(32)
  refId     String?  @db.VarChar(64)
  dedupeKey String   @unique @db.VarChar(180)   // KUNCI anti-double-grant
  createdAt DateTime @default(now())
  @@index([userId, createdAt]) @@index([userId, reason])
}

model Achievement {                 // katalog
  id                 String @id @default(cuid())
  key                String @unique @db.VarChar(64)
  name               String @db.VarChar(120)
  description        String @db.VarChar(400)
  category           AchievementCategory
  tier               AchievementTier
  icon               String @db.VarChar(48)      // slug lucide / emoji (presentasional)
  xpReward           Int    @default(0)
  criteria           Json                        // {"type":"attendance_streak","threshold":7}
  unlocksCosmeticKey String? @db.VarChar(64)     // soft-ref CosmeticItem.key
  hidden             Boolean @default(false)
  isActive           Boolean @default(true)
  sortOrder          Int     @default(0)
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt
  userAchievements   UserAchievement[]
  @@index([category, tier]) @@index([isActive])
}

model UserAchievement {
  id            String @id @default(cuid())
  userId        String
  user          User   @relation(fields:[userId], references:[id], onDelete:Cascade)
  achievementId String
  achievement   Achievement @relation(fields:[achievementId], references:[id], onDelete:Cascade)
  progress      Int      @default(0)
  unlockedAt    DateTime?                        // null = tracked/in-progress
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  @@unique([userId, achievementId]) @@index([userId, unlockedAt])
}

model CosmeticItem {                // katalog
  id                   String @id @default(cuid())
  key                  String @unique @db.VarChar(64)
  name                 String @db.VarChar(120)
  type                 CosmeticType
  rarity               CosmeticRarity @default(COMMON)
  previewRef           String @db.VarChar(120)   // slug preset / asset (mis. "twilight","ring")
  styleConfig          Json                      // preset animasi terkurasi — BUKAN css/js mentah
  unlockType           CosmeticUnlockType @default(FREE)
  unlockLevel          Int?
  unlockAchievementKey String? @db.VarChar(64)   // soft-ref Achievement.key
  isActive             Boolean @default(true)
  sortOrder            Int     @default(0)
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt
  userCosmetics        UserCosmetic[]
  @@index([type, isActive]) @@index([unlockType])
}

model UserCosmetic {                // kepemilikan
  id             String @id @default(cuid())
  userId         String
  user           User   @relation(fields:[userId], references:[id], onDelete:Cascade)
  cosmeticItemId String
  cosmeticItem   CosmeticItem @relation(fields:[cosmeticItemId], references:[id], onDelete:Cascade)
  source         CosmeticSource @default(DEFAULT)
  acquiredAt     DateTime @default(now())
  @@unique([userId, cosmeticItemId]) @@index([userId])
}

model UserProfileConfig {           // yang sedang di-equip
  id                     String @id @default(cuid())
  userId                 String @unique
  user                   User   @relation(fields:[userId], references:[id], onDelete:Cascade)
  equippedBackgroundId   String?      // loose id — divalidasi kepemilikan di server action
  equippedBorderId       String?
  equippedNameplateId    String?
  equippedTitleId        String?
  accentColor            String? @db.VarChar(7)    // #RRGGBB (analog profileAccentHex)
  customBackgroundUrl    String? @db.VarChar(300)  // /uploads/profile-bg/<uid>/<uuid>.webp
  customBorderColor      String? @db.VarChar(7)
  showcaseAchievementIds Json    @default("[]")    // string[] terurut
  createdAt              DateTime @default(now())
  updatedAt              DateTime @updatedAt
}
```

**Kenapa tabel `UserProfileConfig` baru, bukan menumpuk di `User`:** kolom `profile*` lama
tetap dipakai `updateProfileAppearance` & seluruh view; memisahkan equip-state gamifikasi
menjaga "appearance studio" gratis tetap jalan **tanpa flag**, dan tabel gamifikasi hanya
di-load saat flag menyala. **Resolusi render:** equipped di `UserProfileConfig` menang; kalau
null → fallback ke `User.profile*` lama. Jadi menyalakan flag **tidak mengubah tampilan**
sampai user meng-equip sesuatu.

**Equipped id sengaja "loose" `String?`** (bukan FK) supaya item yang di-nonaktifkan tak
pernah memblok baris user; validasi kepemilikan ada di server action (sumber kebenaran authz).

---

## 3. Dua gap schema & resolusinya (keduanya additive & patuh aturan)

**(a) Task tak punya timestamp "selesai" andal** → tambah **`Task.completedAt DateTime?`**,
di-set pada transisi DONE yang **sudah ada** di `tasks.ts` (`moveTask`/`moveTaskStatus`/
`updateTask`, tiap-tiap sudah dijaga `status===DONE && task.status!==DONE` = **first-close**).
Ini menulis **fakta domain Task**, bukan XP menulis ke task — **XP engine hanya membaca**
`completedAt` + `dueDate`. Derivasi jadi trivial & idempotent: on-time = `dueDate==null ? true
: completedAt<=dueDate`; first-close-only karena guard false setelah DONE; grant dedupe
`task_ontime:<taskId>`. (Lebih robust dari pure event-grant: cron harian bisa memperbaiki
grant yang terlewat karena `completedAt` tersimpan.)

**(b) Absensi tak punya konsep on-time** → konstanta tunable:
```ts
// src/lib/gamification/constants.ts
export const ATTENDANCE_TZ = "Asia/Jakarta";
export const ATTENDANCE_ONTIME_CUTOFF = process.env.ATTENDANCE_ONTIME_CUTOFF ?? "09:15";
// = jam masuk 09:00 + toleransi 15 menit (keputusan user)
```
- **verified check-in** = `type==="CHECK_IN" && confidence>0` (konvensi existing).
- **on-time** = `timestamp` (UTC) dikonversi ke Asia/Jakarta `≤ ATTENDANCE_ONTIME_CUTOFF`.
  Konversi via `Intl.DateTimeFormat("en-GB",{timeZone:ATTENDANCE_TZ,hour,minute,hourCycle:"h23"})`
  — **jangan** bandingkan UTC mentah. Day-key streak pakai TZ yang sama (reuse `today` yang
  route sudah hitung).

---

## 4. Kurva XP → Level (tunable) + strategi backfill lantai

Kurva tersimpan sebagai konstanta murni (`src/lib/gamification/level.ts`), delta per-level
kuadratik (akumulatif kubik, tanpa cliff):
```ts
export const XP_CURVE = { BASE: 100, LINEAR: 50, QUAD: 5 } as const;   // tunable
levelDelta(L) = BASE + LINEAR*(L-2) + QUAD*(L-2)*(L-3);   // XP dari L-1 → L (L≥2)
cumXp(L)      = Σ levelDelta   // cumulative; cumXp(1)=0
levelFromXp(xp) = L terbesar dgn cumXp(L) ≤ xp   // cap MAX_LEVEL=50
```

| Lvl | Cum XP | Δ | Lvl | Cum XP | Δ |
|---:|---:|---:|---:|---:|---:|
| 1 | 0 | — | 11 | 4.450 | 910 |
| 2 | 100 | 100 | 12 | 5.500 | 1.050 |
| 3 | 250 | 150 | 13 | 6.700 | 1.200 |
| 4 | 460 | 210 | 14 | 8.060 | 1.360 |
| 5 | 740 | 280 | 15 | 9.590 | 1.530 |
| 6 | 1.100 | 360 | 16 | 11.300 | 1.710 |
| 7 | 1.550 | 450 | 17 | 13.200 | 1.900 |
| 8 | 2.100 | 550 | 18 | 15.300 | 2.100 |
| 9 | 2.760 | 660 | 19 | 17.610 | 2.310 |
| 10 | 3.540 | 780 | 20 | 20.140 | 2.530 |

Kalibrasi: EMPLOYEE aktif ~**150 XP/minggu** (5 check-in on-time + ~2 task on-time + 1 modul
fresh) → level awal naik **1–2 minggu**, melambat di L12+. **Angka final di-set produk setelah
2–3 minggu data ledger nyata.**

**Backfill lantai (tak ada yang turun):**
```
oldLevel  = max(1, floor(tenureDays/30)+1)     // level UI existing = LANTAI
seededXp  = cumXp(oldLevel)                     // pas cukup utk duduk di oldLevel
finalLevel = max(levelFromXp(xpTotal), oldLevel)
```
Karena `seededXp=cumXp(oldLevel)` maka `levelFromXp(seededXp)≥oldLevel` → **level tak mungkin
turun**. Ditulis 1 baris `XpLedger{reason:TENURE, dedupeKey:"tenure:<uid>", amount:seededXp}`.
Invarian `max(...)` juga ditegakkan di `grant.ts` sehingga perubahan kurva pun tak mendemosikan
siapa pun. Tenure anniversary (+50 tiap 30 hari, dedupe `tenure:<uid>:<monthIndex>`) memberi
trickle pasif.

---

## 5. XP sources (semua idempotent via `dedupeKey`, outcome-based)

| Source | XP | Aturan | dedupeKey | Anti-gaming |
|---|---|---|---|---|
| **Verified check-in** | `BASE 10`, jika **on-time** → `×streakMult` (cap ×2.0); telat → flat 10 (tanpa penalti) | EMPLOYEE only, 1×/hari; streak = hari kerja berturut ada check-in | `attendance:<uid>:<date>` | unik per hari; butuh `confidence>0` (face-match nyata) — tak bisa self-issue/klaim ganda |
| **Task closed ≤ due** | `+25` | first DONE only, `dueDate==null || completedAt<=dueDate`; overdue-close = 0 (tanpa penalti); **tak ada** XP create/move/reopen | `task_ontime:<taskId>` | 1 grant/task seumur hidup; reopen→reclose tak menambah; hanya transisi penutup yang dinilai |
| **Kesegaran data mingguan** | `+15 / modul / ISO-week` | dari `updatedAt`/`postedAt`/`finishedAt`, bukan jumlah edit | `data_fresh:<module>:<uid>:<isoWeek>` | menilai adanya timestamp fresh/minggu; spam simpan sehari = 1 award |
| **Achievement** | `= xpReward` | saat unlock | `achievement:<uid>:<key>` | 1 `UserAchievement` unik; criteria dievaluasi dari tabel sumber, bukan input klien |
| **Tenure** | `cumXp(oldLevel)` / `+50` | backfill + milestone 30-hari | `tenure:<uid>` / `tenure:<uid>:<monthIndex>` | dari `createdAt` immutable |

**Streak multiplier (bertingkat, ber-cap; hanya untuk bonus on-time):**
| Hari on-time berturut | ×1–2 | ×3–6 | ×7–13 | ×14+ |
|---|---|---|---|---|
| Multiplier | ×1.0 | ×1.25 | ×1.5 | ×2.0 (cap) |

Streak = presensi (jaga adopsi); multiplier & bonus = punctuality. Reset saat bolong hari
kerja (Sen–Jum; akhir pekan/hari libur tak memutus — lihat Risiko #2). Semua nilai di
`constants.ts`.

---

## 6. Katalog awal (seed, data-driven)

### Achievements (~12) — `criteria` machine-evaluable
| key | nama | kategori/tier | xp | criteria | unlock cosmetic | hidden |
|---|---|---|---|---|---|---|
| `attendance_7` | Rajin Seminggu | ATTENDANCE/BRONZE | 100 | `{type:"attendance_streak",threshold:7}` | `border-orbit` | — |
| `attendance_30` | Sebulan Penuh | ATTENDANCE/SILVER | 300 | `{…threshold:30}` | `bg-aurora` | — |
| `attendance_100` | Legenda Absensi | ATTENDANCE/GOLD | 800 | `{…threshold:100}` | `nameplate-molten` | — |
| `task_ontime_10` | Tepat Waktu | TASK/BRONZE | 150 | `{type:"task_ontime_count",threshold:10}` | — | — |
| `task_ontime_50` | Mesin Deadline | TASK/GOLD | 600 | `{…threshold:50}` | `border-foil` | — |
| `clean_board` | Papan Bersih | TASK/SILVER | 250 | `{type:"zero_overdue_days",threshold:7}` | `title-clean` | — |
| `firefighter` | Pemadam Kebakaran | TASK/SILVER | 250 | `{type:"overdue_recovered",threshold:5,windowDays:7}` | `bg-bokeh` | — |
| `data_curator` | Kurator Data | DATA/GOLD | 400 | `{type:"fresh_modules_weeks",modules:3,weeks:4}` | `nameplate-glass` | — |
| `founding_member` | Anggota Perintis | MILESTONE/PLATINUM | 500 | `{type:"tenure_days",threshold:180}` | `title-founder` | — |
| `level_10` | Naik Kelas | MILESTONE/SILVER | 200 | `{type:"level_reached",threshold:10}` | `title-lvl10` | — |
| `night_owl` | Kalong Kantor 🦉 | ATTENDANCE/BRONZE | 150 | `{type:"checkin_before_hour",hour:7,count:5}` | `bg-parallax` | **hidden** |
| `comeback_kid` | Balik Lagi | ATTENDANCE/BRONZE | 120 | `{type:"streak_rebuilt",threshold:7}` | — | **hidden** |

### Cosmetics (~20) — `styleConfig` tak pernah berisi hex; `palette:"theme"` = sample token
**FREE (hari 1, grandfather — tak ada yang hilang):**
- 12 background preset (`bg-preset-twilight…candy`, `{effect:"gradient",preset:"twilight"}` reuse `bannerGradientCss`) · 5 frame (`border-ring/glow/gem/dashed/none`) · `accent-custom` (pakai `profileAccentHex`) · `border-color-custom` · `bg-upload-slot` (CUSTOM_UPLOAD, sharp re-encode→webp). Pattern & sticker existing ikut sebagai bagian styleConfig FREE.

**EARNED (LEVEL/ACHIEVEMENT, animated, palet = token tema):**
| key | tipe | rarity | unlock | styleConfig |
|---|---|---|---|---|
| `bg-aurora` | BACKGROUND | RARE | ach `attendance_30` | `{effect:"aurora-webgl",palette:"theme",intensity:2}` |
| `bg-bokeh` | BACKGROUND | RARE | ach `firefighter` | `{effect:"bokeh-webgl",palette:"theme",particles:40}` |
| `bg-parallax` | BACKGROUND | EPIC | ach `night_owl` | `{effect:"parallax",layers:3,palette:"theme"}` |
| `bg-shader-flux` | BACKGROUND | EPIC | Lv15 | `{effect:"shader-flux",palette:"theme"}` |
| `border-orbit` | BORDER | RARE | ach `attendance_7` | `{effect:"orbit-glow",palette:"theme"}` |
| `border-foil` | BORDER | EPIC | ach `task_ontime_50` | `{effect:"foil",palette:"theme"}` |
| `border-holo` | BORDER | EPIC | Lv12 | `{effect:"holographic",asset:"apng"}` |
| `nameplate-molten` | NAMEPLATE | LEGENDARY | ach `attendance_100` | `{effect:"molten",palette:"theme"}` |
| `nameplate-glass` | NAMEPLATE | EPIC | ach `data_curator` | `{effect:"glass",palette:"theme"}` |
| `title-lvl10` / `title-founder` / `title-clean` | TITLE | RARE/LEGENDARY | ach terkait | `{effect:"title",text:"…"}` |
| `title-role-flair` | TITLE | RARE | Lv8 | `{effect:"title",source:"role"}` |
| `showcase-slot-2/3` | (meta) | RARE | Lv5 / Lv10 | `{effect:"showcase-slot"}` |

---

## 7. Arsitektur XP engine

```
src/lib/gamification/
  flag.ts          isProfileGamificationEnabled() → process.env.PROFILE_GAMIFICATION_ENABLED==="true"
  constants.ts     XP amounts · streak table · cutoff · curve params · caps
  level.ts         levelFromXp / cumXp (pure, tested)
  grant.ts         grantXp(...) idempotent + recompute progression (level tak pernah turun)
  attendance-xp.ts onVerifiedCheckIn(userId,date,timestamp) → streak + grant
  task-xp.ts       onTaskDone(taskId) → TASK_ONTIME grant
  freshness-xp.ts  DATA_FRESH (cron only)
  achievements.ts  evaluasi criteria + unlock (grant XP + UserCosmetic + notifyUser)
  reconcile.ts     orkestrasi cron harian (freshness · streak self-heal · backfill historis)
```

**`grantXp` idempotent:** `XpLedger.createMany({skipDuplicates:true})` (unik `dedupeKey` →
duplikat = no-op) → increment `xpTotal` → `newLevel=max(levelFromXp,storedLevel)` → return
`{granted, leveledUp, newLevel}`. Grant satu event di dalam `$transaction` yang sudah ada.

**Integration points (semua diawali `if (!isProfileGamificationEnabled()) return;`, fire-and-
forget + try/catch — tak pernah menggagalkan aksi utama):**
- `POST /api/attendance/route.ts` (setelah `attendance.create`): `void onVerifiedCheckIn(...)`
  lalu `void evaluateAchievements(uid,{trigger:"attendance"})`.
- `tasks.ts` transisi DONE (setelah set `completedAt`): `void onTaskDone(taskId)` → evaluasi
  achievement TASK.
- Cron baru `api/cron/gamification-sync/route.ts` (skeleton = research-sync: `CRON_SECRET`
  503-if-unset + `Bearer`): (1) freshness per modul, (2) rekonsiliasi streak + recompute
  `xpTotal` self-heal, (3) backfill achievement historis idempotent. Semua grant dedupe → aman
  diulang. Handler di-gate flag.

**Achievement unlock:** set `unlockedAt` (unik `(userId,achievementId)` → sekali) → `grantXp
(ACHIEVEMENT)` → jika `unlocksCosmeticKey` → `UserCosmetic.createMany({skipDuplicates})` →
`notifyUser(uid,"🏆 Pencapaian baru: …",ACHIEVEMENT_UNLOCKED)`. Tambah map
`ACHIEVEMENT_UNLOCKED → /profile` di `notification-link.ts`.

---

## 8. Migrasi additive + backfill

**Migration** (`prisma migrate dev --name gamification_fase1`, lokal saja, **bukan** db push):
7 enum baru + `NotificationType.ACHIEVEMENT_UNLOCKED`; 7 tabel baru; `Task.completedAt DateTime?`.
Tak ada perubahan kolom existing. `npx prisma validate` wajib lolos; SQL disertakan untuk review.

**Seed katalog** (`prisma/scripts/seed-gamification.ts`, `upsert` by `key`, idempotent): semua
FREE (preset/frame/pattern/sticker legacy) + item earned + achievement.

**Backfill** (`prisma/scripts/backfill-gamification.ts`, via `tsx`, guard `isLocalDatabase`):
per user → (1) tenure seed + lantai level (§4), (2) rekonsiliasi achievement historis dari data
read-only (streak absensi, count on-time), unlock idempotent tanpa notifikasi, (3) buat
`UserProfileConfig` kosong (lazy juga boleh). **Task on-time TIDAK di-backfill** (forward-only,
keputusan user) — `completedAt` task lama boleh diisi `updatedAt` sebagai proxy tampilan saja,
tanpa grant XP.

---

## 9. Server actions / API surface (`src/actions/gamification.ts`)

Pola sama profil (`auth()` → own-record → zod → Indonesian error → `revalidatePath`). Semua
read early-return "disabled shape" bila flag off.
- `getProfile(userId)` — public read, merge `getProfileShowcaseData` + level/xp/streak/achievement.
- `getProfileConfig()` — equipped resolved + fallback `profile*`.
- `updateProfileConfig(input)` — zod; **validasi kepemilikan server-side tiap equipped id**
  (`UserCosmetic` ada + tipe cocok slot; `unlockLevel ≤ level`; `showcaseAchievementIds` semua
  unlocked); accent/border hex via `normalizeProfileAccentHex`. Tolak dgn error Indonesia.
- `listCosmetics()` — owned + locked + syarat unlock.
- `listAchievements()` — unlocked + progress; sembunyikan `hidden && !unlocked` sebagai "???".
- `uploadCustomBackground(formData)` — reuse pipeline avatar + **sharp** (`.rotate()` strip EXIF
  → `.resize({fit:"inside",withoutEnlargement:true})` → `.webp()`), MIME allowlist (png/jpg/webp),
  cap ukuran & dimensi, simpan `/uploads/profile-bg/<uid>/<uuid>.webp`, unlink lama, tulis
  `customBackgroundUrl`. **Tolak URL eksternal** (cegah SSRF). Optional gate `≥ Lv.2` (anti-spam).

---

## 10. Frontend — animation stack + wireframe

**Stack (disetujui, semua lazy + di balik flag & toggle animasi):**
| Layer | Lib | Strategi muat |
|---|---|---|
| Orkestrasi UI: count-up level, spring XP bar, streak pulse, celebration | **framer-motion** (`motion/react`, hormati `useReducedMotion()`, hanya transform/opacity) | client island profil |
| Background hidup (aurora/bokeh/parallax/shader) | **OGL** (~10–15KB, dipilih vs three/pixi krn bundle) | `next/dynamic(...,{ssr:false})`, boot **hanya saat on-screen & tab visible** |
| Badge / level-up celebration | **@lottiefiles/dotlottie-web** | dynamic import saat pertama celebration |
| Frame avatar terkurasi (holo/foil) | **APNG / animated-WebP** via `<img loading="lazy">` | native lazy, zero-JS |

**Kontrak animasi (hook `useAnimationGate`):** `IntersectionObserver` (offscreen → destroy
WebGL ctx) + `visibilitychange` (tab hidden → pause) · cap partikel & `devicePixelRatio` (≤2) ·
FPS sampler → turunkan intensity/fallback statis bila <50fps 2 dtk · `prefers-reduced-motion`
atau toggle off atau flag off → **fallback statis cakep** (engine tak di-import) · 1 background
+ 1 frame live per halaman.

**Theme sampling (WAJIB — jangan hardcode):** efek WebGL baca token aktif via `getComputedStyle`
(browser konversi `oklch(var(--primary))` → `rgb()`), `MutationObserver` di
`document.documentElement` (attr `data-theme` + inline `style` yang di-set `app-theme-provider`)
→ re-sample → update uniform → aurora/bokeh **ganti warna instan** saat ganti tema. `palette:
"theme"` di `styleConfig` memetakan token ke slot uniform.

**Wireframe — Profil view (showpiece):**
```
┌───────────────────────────────────────────────────────────────┐
│ ░ LIVE NAMEPLATE/BG (WebGL aurora, palette=theme) ░  ● Online   │
│  ┌──────┐  Nama  «Title»                    ┌──────────────┐    │
│  │AVATAR│  @role · tagline                  │ ⬆ LEVEL 12   │    │ ← count-up
│  │+frame│  Bergabung 8 Jul 2024             │ ███████░ 62% │    │ ← spring XP bar
│  └──────┘  🔥 Streak 14 (pulse) · Max 21    │ 5.500 XP →   │    │
├───────────────────────────────────────────────────────────────┤
│ ✦ CELEBRATION sekali/unlock (dotlottie, reduced-motion aware)   │
├───────────────────────────────────────────────────────────────┤
│ SHOWCASE (foil-on-hover, material per tier) │ STAT (tilt 3D)    │
│ [🏆Gold][🥈Silver][🥉Bronze]                │ [42][6][318]      │
├───────────────────────────────────────────────────────────────┤
│ ACHIEVEMENT SHELF ▸ 9/12   [Lihat Galeri →]  🏅🏅🏅🏅🔒 ???      │
├───────────────────────────────────────────────────────────────┤
│ Statistik kerja · Ruangan · Aktivitas terbaru  (PRESERVED,polish)│
└───────────────────────────────────────────────────────────────┘
```
**Wireframe — Edit profil (2 kolom):**
```
┌─────────────────────────┬────────────────────────────────────┐
│ LIVE PREVIEW (sticky)    │ [1 Identitas][2 Tampilan][3 Show..] │
│ render animasi kosmetik   │ [4 Achievements]                    │
│ SUNGGUHAN (runtime sama   │ Tab2: Background grid owned/🔒gembok │
│ dgn view)                 │  +tooltip syarat · [Upload latar]   │
│  ┌────────────────────┐   │  Frame grid + 🎨color · Nameplate   │
│  │~aurora~  LVL12 ███░ │   │  Accent 🎨 · Animasi [●ON]          │
│  └────────────────────┘   │ Tab3: dnd-kit drag-order + slot 🔒  │
│ (mobile: preview di ATAS) │ Tab4: gallery ✓/🔒progress/??? hidden│
│ ──────────────────────────────────────────────────────────────│
│                            [ Batal ]   [ Simpan ]              │
└─────────────────────────┴────────────────────────────────────┘
States: loading=skeleton · empty=default · error=toast(sonner)+inline
Save → server re-validasi kepemilikan (equip hanya yang dimiliki).
```
Reuse: `@dnd-kit/sortable` (sudah ada) utk showcase, TipTap (sudah ada) utk About, `sonner`
utk toast. Extend `profile-form.tsx` + `edit/page.tsx`.

---

## 11. Rencana test (Vitest, Prisma di-mock via `vi.hoisted` + `vi.mock("@/lib/prisma")`)

grant idempoten/dedupe · kurva `level.ts` round-trip & monoton · **level tak turun** · streak
(+1 hari berurut / 0 hari sama / reset saat bolong) · streak multiplier + cap · **on-time cutoff
lintas TZ** (`02:30Z`=09:30 WIB→telat; `01:30Z`=08:30→on-time; env override) · task on-time
(`completedAt≤dueDate`, null dueDate=on-time, dedupe) · **penolakan equip item tak dimiliki /
slot mismatch / showcase belum unlock** · **feature-flag gate** (off → no-op, list=empty;
save/restore `process.env`) · achievement unlock (sekali, grant+cosmetic+notify, ulang=diam) ·
backfill lantai level.

---

## 12. Kepatuhan Aturan Keras (checklist)

- [x] **Tak sentuh DB prod** — semua `prisma migrate dev` lokal; backfill guard `isLocalDatabase`.
- [x] **Tanpa `db push --accept-data-loss`** — pakai `migrate dev`, SQL untuk review.
- [x] **Additive-only** — tabel/enum/kolom nullable-atau-default baru; nol drop/rename/rewrite.
      XP hanya **membaca** absensi/task/chat/finance.
- [x] **Preservasi data & level tak turun** — lantai `max(levelFromXp, oldMembershipLevel)`.
- [x] **Authz server-side** — own-record; equip divalidasi kepemilikan; `/api/ai/*` tetap read-only.
- [x] **Test wajib** — tiap perubahan bertes; `lint && test && build && prisma validate`.
- [x] **Feature flag** — `PROFILE_GAMIFICATION_ENABLED` (default off; tambah baris `.env.example`).
- [x] **Tema-agnostic** — chrome & efek earned ikut token; preset lama grandfathered sbg art
      dgn overlay kontras; **tak ada** css/js mentah dari user; upload di-re-encode.

---

## 13. Verifikasi (end-to-end)

1. `PROFILE_GAMIFICATION_ENABLED=false` → profil lama render **identik** (regresi nol).
2. `npx prisma validate` + `prisma migrate dev` lokal → migrasi additive lolos; seed katalog.
3. `npm run test` → semua unit test gamifikasi hijau; `npm run lint && npm run build` bersih.
4. Nyalakan flag utk diri sendiri: `POST /api/attendance` (CHECK_IN, confidence>0) → cek
   `XpLedger` + `UserProgression` (XP naik, streak, dedupe hari sama tak dobel).
5. Tutup task sebelum due → `Task.completedAt` terisi, `task_ontime:<id>` grant sekali;
   reopen→reclose tak menambah.
6. Trigger achievement `attendance_7` → `UserAchievement.unlockedAt`, XP bonus, `UserCosmetic`
   `border-orbit`, notifikasi 🏆.
7. Edit profil: equip cosmetic dimiliki → tersimpan & live preview beranimasi; coba equip yang
   **tidak dimiliki** via payload → **ditolak server**. Upload background → tersimpan `.webp`
   (EXIF ter-strip).
8. Ganti tema di Theme Studio → background WebGL **re-color** mengikuti token; toggle reduced-
   motion / animasi-off → fallback statis; scroll offscreen / pindah tab → animasi pause.
9. Cron: `GET /api/cron/gamification-sync` dgn `Bearer CRON_SECRET` → grant freshness + self-heal
   idempotent (jalankan 2× → tak ada dobel).

---

## 14. Rencana rilis per-fase (PR terpisah, jangan satu PR raksasa)

> Catatan proses: **tambah entri changelog dulu** sebelum membuat/merge tiap PR.

1. **FASE 2 · PR — Data model** — schema additive + migrasi + `prisma validate` + seed katalog.
2. **FASE 3 · PR — Engine** — `src/lib/gamification/*` + integrasi absensi/task + cron + notifikasi + test.
3. **FASE 3 · PR — Backfill & flag** — script backfill (lantai level, achievement historis) + flag + `.env.example`.
4. **FASE 4 · PR — Frontend view** — showpiece profil (hero XP/level/streak, showcase, celebration, WebGL bg).
5. **FASE 4 · PR — Edit profil** — 2 kolom + 4 tab + live preview + upload custom background.
6. **FASE 5 · PR — Rollout** — `docs/design/DEPLOY-CHECKLIST.md` + panel metrik adopsi + verifikasi pasca-deploy.

Tiap PR: `lint && test && build && prisma validate` hijau + entri changelog.

---

## 15. Risiko & ambiguitas (untuk diputuskan saat implementasi)

1. **Kalibrasi kurva & nilai XP** = estimasi; final di-set produk setelah 2–3 minggu data ledger.
2. **Definisi hari kerja/hari libur untuk reset streak** — belum ada tabel libur; usul: streak
   putus hanya bila bolong **Sen–Jum** (configurable), akhir pekan diabaikan; tabel libur = future.
3. **FREELANCE** tak ikut absensi → jalur attendance XP inert (benar); tetap dapat task/tenure XP.
4. **Cron gamifikasi** pakai log ringan sendiri (tak dikopel `ResearchCronRun`) agar tak muncul di
   panel data-health research.
5. **Un-done → re-done task:** `completedAt` di-set sekali (first close), tak di-null saat keluar
   DONE — "first close only".
6. **Preset lama tetap hex** (grandfathered) — konsisten dgn keputusan user; bila kelak ingin
   full tema-agnostic, konversi bisa jadi item terpisah.

---

**FASE 1 selesai. Menunggu approval untuk lanjut ke FASE 2 (Data model & migration).**
