-- Penanda versi katalog gamifikasi terakhir yang disinkronkan ke DB.
-- Dibaca/ditulis `ensureGamificationCatalog()` (dipanggil dari instrumentation
-- saat server boot) supaya katalog auto-sync tiap deploy — tanpa seed manual.
ALTER TABLE "AppBranding" ADD COLUMN "gamificationCatalogVersion" TEXT;
