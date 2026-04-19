-- Jalankan SEBELUM `npx prisma db push` jika push gagal karena kolom roomId NOT NULL
-- pada Project yang sudah punya baris.
-- Alur: buat tabel Room (jika belum ada), tambah roomId nullable, isi data, NOT NULL + FK.

BEGIN;

CREATE TABLE IF NOT EXISTS "Room" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "brandId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  ALTER TABLE "Room"
    ADD CONSTRAINT "Room_brandId_fkey"
    FOREIGN KEY ("brandId") REFERENCES "Brand"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "Project" ADD COLUMN "roomId" TEXT;
EXCEPTION
  WHEN duplicate_column THEN NULL;
END $$;

INSERT INTO "Room" ("id", "name", "brandId", "createdAt", "updatedAt")
SELECT
  'legacy-room-' || p."id",
  COALESCE(b."name", 'Brand') || ' — Ruangan migrasi',
  p."brandId",
  NOW(),
  NOW()
FROM "Project" p
LEFT JOIN "Brand" b ON b."id" = p."brandId"
WHERE p."roomId" IS NULL
ON CONFLICT ("id") DO NOTHING;

UPDATE "Project" p
SET "roomId" = 'legacy-room-' || p."id"
WHERE p."roomId" IS NULL;

ALTER TABLE "Project" ALTER COLUMN "roomId" SET NOT NULL;

DO $$
BEGIN
  ALTER TABLE "Project"
    ADD CONSTRAINT "Project_roomId_fkey"
    FOREIGN KEY ("roomId") REFERENCES "Room"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMIT;
