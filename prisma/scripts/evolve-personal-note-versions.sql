-- Tabel checkpoint versi catatan pribadi (PersonalNoteVersion) — idempotent,
-- aman dijalankan berulang. Padanan deklarasinya ada di schema.prisma; skrip ini
-- untuk DB Production yang belum bisa `db push` karena drift lain. Nama tabel,
-- constraint, dan index mengikuti konvensi Prisma (Tabel_kolom_key/_idx/_fkey)
-- supaya `db push` berikutnya tidak membuat duplikat.
--
-- Root cause: model PersonalNoteVersion sudah ada di schema & Prisma Client,
-- `personalNote.create()` menulis versi awal dalam transaksi yang sama, tapi
-- tabelnya belum pernah dibuat di Production → P2021.

CREATE TABLE IF NOT EXISTS "PersonalNoteVersion" (
  "id"        TEXT         NOT NULL,
  "noteId"    TEXT         NOT NULL,
  "ownerId"   TEXT         NOT NULL,
  "revision"  INTEGER      NOT NULL,
  "title"     VARCHAR(160) NOT NULL,
  "content"   TEXT         NOT NULL,
  "reason"    VARCHAR(32)  NOT NULL DEFAULT 'autosave',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PersonalNoteVersion_pkey" PRIMARY KEY ("id")
);

-- @@unique([noteId, revision])
CREATE UNIQUE INDEX IF NOT EXISTS "PersonalNoteVersion_noteId_revision_key"
  ON "PersonalNoteVersion" ("noteId", "revision");

-- @@index([noteId, createdAt(sort: Desc)])
CREATE INDEX IF NOT EXISTS "PersonalNoteVersion_noteId_createdAt_idx"
  ON "PersonalNoteVersion" ("noteId", "createdAt" DESC);

-- FK noteId -> PersonalNote(id) ON DELETE CASCADE (ADD CONSTRAINT tanpa IF NOT EXISTS)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PersonalNoteVersion_noteId_fkey'
  ) THEN
    ALTER TABLE "PersonalNoteVersion"
      ADD CONSTRAINT "PersonalNoteVersion_noteId_fkey"
      FOREIGN KEY ("noteId") REFERENCES "PersonalNote"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- FK ownerId -> User(id) ON DELETE CASCADE
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PersonalNoteVersion_ownerId_fkey'
  ) THEN
    ALTER TABLE "PersonalNoteVersion"
      ADD CONSTRAINT "PersonalNoteVersion_ownerId_fkey"
      FOREIGN KEY ("ownerId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
