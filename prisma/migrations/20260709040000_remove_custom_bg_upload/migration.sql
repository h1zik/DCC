-- Hapus fitur "Upload latar sendiri" di profil user. Semua latar kini berasal
-- dari katalog: preset gratis (FREE) + background yang ditambahkan admin di menu
-- Gamifikasi. Slot upload dinonaktifkan dan dilepas dari config yang memakainya.

-- Lepas slot upload dari user yang masih meng-equip-nya → fallback ke preset default.
UPDATE "UserProfileConfig"
SET "equippedBackgroundId" = NULL
WHERE "equippedBackgroundId" IN (
  SELECT "id" FROM "CosmeticItem" WHERE "key" = 'bg-upload-slot'
);

-- Pensiunkan latar unggahan lama (data dormant, kolom dipertahankan untuk histori).
UPDATE "UserProfileConfig"
SET "customBackgroundUrl" = NULL,
    "customBackgroundMedia" = NULL
WHERE "customBackgroundUrl" IS NOT NULL;

-- Sembunyikan item slot upload dari katalog kosmetik.
UPDATE "CosmeticItem" SET "isActive" = false WHERE "key" = 'bg-upload-slot';
