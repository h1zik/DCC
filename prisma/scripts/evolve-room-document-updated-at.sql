-- Backfill kolom updatedAt (fitur versi/berbagi dokumen) — idempotent.
-- `db push` menolak menambah kolom NOT NULL tanpa default saat tabel sudah
-- berisi baris. Skrip ini menambah kolom nullable dulu, isi nilainya dari
-- createdAt, baru kunci jadi NOT NULL — setelah itu skema & DB sinkron dan
-- `db push` berikutnya tidak akan mengeluh lagi.

ALTER TABLE "RoomDocument" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3);
UPDATE "RoomDocument" SET "updatedAt" = "createdAt" WHERE "updatedAt" IS NULL;
ALTER TABLE "RoomDocument" ALTER COLUMN "updatedAt" SET NOT NULL;

ALTER TABLE "RoomDocumentFolder" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3);
UPDATE "RoomDocumentFolder" SET "updatedAt" = "createdAt" WHERE "updatedAt" IS NULL;
ALTER TABLE "RoomDocumentFolder" ALTER COLUMN "updatedAt" SET NOT NULL;
