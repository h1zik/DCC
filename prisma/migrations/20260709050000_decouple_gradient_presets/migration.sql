-- Preset gradient banner (Twilight–Candy) kini di-hard-code di editor gamifikasi
-- dan disimpan di `User.profileBannerPreset` — persis seperti mode non-gamifikasi.
-- Preset TIDAK lagi berupa CosmeticItem `bg-preset-*`; katalog DB murni untuk
-- background unlockable yang diatur admin di menu Gamifikasi. Migrasi ini
-- memindahkan user yang terlanjur meng-equip preset ke kolom legacy, lalu
-- mempensiunkan baris katalognya. (Data-only — skema tidak berubah.)

-- 1) User yang meng-equip preset gradient → kembalikan ke kolom legacy user.
--    `previewRef` baris `bg-preset-*` berisi id preset yang valid (mis. "candy").
UPDATE "User" u
SET "profileBannerPreset" = ci."previewRef"
FROM "UserProfileConfig" upc
JOIN "CosmeticItem" ci ON ci."id" = upc."equippedBackgroundId"
WHERE upc."userId" = u."id"
  AND ci."key" LIKE 'bg-preset-%';

-- 2) Kosongkan slot equip yang menunjuk ke preset gradient (kini hard-coded).
UPDATE "UserProfileConfig" upc
SET "equippedBackgroundId" = NULL
FROM "CosmeticItem" ci
WHERE ci."id" = upc."equippedBackgroundId"
  AND ci."key" LIKE 'bg-preset-%';

-- 3) Pensiunkan preset gradient dari katalog kosmetik (tak lagi di-seed).
UPDATE "CosmeticItem" SET "isActive" = false WHERE "key" LIKE 'bg-preset-%';
