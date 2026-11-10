-- Mode akun (satu akun bisa berpindah ke beberapa peran) — ADITIF SAJA.
-- Satu kolom nullable baru di "User" + satu tabel baru. Tidak ada backfill:
-- "primaryCustomRoleId" NULL berarti akun tidak sedang berpindah mode.

-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "primaryCustomRoleId" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "UserModeGrant" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "customRoleId" TEXT NOT NULL,
    "grantedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserModeGrant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "User_primaryCustomRoleId_idx" ON "User"("primaryCustomRoleId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "UserModeGrant_userId_customRoleId_key" ON "UserModeGrant"("userId", "customRoleId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "UserModeGrant_customRoleId_idx" ON "UserModeGrant"("customRoleId");

-- AddForeignKey (idempoten: lewati bila constraint sudah ada)
DO $$ BEGIN
  ALTER TABLE "User" ADD CONSTRAINT "User_primaryCustomRoleId_fkey" FOREIGN KEY ("primaryCustomRoleId") REFERENCES "CustomRole"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "UserModeGrant" ADD CONSTRAINT "UserModeGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "UserModeGrant" ADD CONSTRAINT "UserModeGrant_customRoleId_fkey" FOREIGN KEY ("customRoleId") REFERENCES "CustomRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "UserModeGrant" ADD CONSTRAINT "UserModeGrant_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
