-- KOL Hub fase 3 — ADITIF SAJA. Tidak mengubah tabel Finance: hanya kolom
-- nullable KolSchedule.spendRequestId (FK ke FinanceSpendRequest, ON DELETE SET NULL,
-- jadi reset data demo Finance tetap berjalan) + tabel template & dokumen SPK.

-- CreateEnum
CREATE TYPE "KolSpkScope" AS ENUM ('ORGANIZATION', 'BRAND');

-- CreateEnum
CREATE TYPE "KolSpkStatus" AS ENUM ('GENERATED', 'SENT', 'SIGNED');

-- AlterTable
ALTER TABLE "KolSchedule" ADD COLUMN IF NOT EXISTS "spendRequestId" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "KolSpkTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "scope" "KolSpkScope" NOT NULL DEFAULT 'ORGANIZATION',
    "brandId" TEXT,
    "body" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KolSpkTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "KolSpkDocument" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "templateId" TEXT,
    "docNumber" TEXT NOT NULL,
    "renderedBody" TEXT NOT NULL,
    "status" "KolSpkStatus" NOT NULL DEFAULT 'GENERATED',
    "generatedById" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "signedAt" TIMESTAMP(3),
    "signedFileKey" TEXT,
    "signedFileName" TEXT,
    "signedMime" TEXT,
    "signedSize" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KolSpkDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "KolSpkTemplate_brandId_idx" ON "KolSpkTemplate"("brandId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "KolSpkDocument_scheduleId_key" ON "KolSpkDocument"("scheduleId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "KolSpkDocument_docNumber_key" ON "KolSpkDocument"("docNumber");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "KolSpkDocument_status_idx" ON "KolSpkDocument"("status");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "KolSchedule_spendRequestId_key" ON "KolSchedule"("spendRequestId");

-- AddForeignKey
ALTER TABLE "KolSchedule" ADD CONSTRAINT "KolSchedule_spendRequestId_fkey" FOREIGN KEY ("spendRequestId") REFERENCES "FinanceSpendRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KolSpkTemplate" ADD CONSTRAINT "KolSpkTemplate_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KolSpkTemplate" ADD CONSTRAINT "KolSpkTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KolSpkDocument" ADD CONSTRAINT "KolSpkDocument_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "KolSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KolSpkDocument" ADD CONSTRAINT "KolSpkDocument_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "KolSpkTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KolSpkDocument" ADD CONSTRAINT "KolSpkDocument_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

