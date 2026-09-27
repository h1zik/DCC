-- KOL Hub fase 2 — ADITIF SAJA: tabel snapshot/sync/konfigurasi baru dan kolom
-- cache metrik nullable/default di KolSchedule. Nilai default konfigurasi & CPM
-- acuan dibuat idempoten oleh aplikasi (ensureKolRateDefaults).

-- CreateEnum
CREATE TYPE "KolSyncStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED');

-- AlterTable
ALTER TABLE "KolSchedule" ADD COLUMN IF NOT EXISTS "decayRate" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "followersAtBooking" INTEGER,
ADD COLUMN IF NOT EXISTS "fypReachedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "isFyp" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "latestComments" INTEGER,
ADD COLUMN IF NOT EXISTS "latestLikes" INTEGER,
ADD COLUMN IF NOT EXISTS "latestShares" INTEGER,
ADD COLUMN IF NOT EXISTS "latestViews" INTEGER,
ADD COLUMN IF NOT EXISTS "metricsError" TEXT,
ADD COLUMN IF NOT EXISTS "metricsSyncedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "peakVelocity" INTEGER,
ADD COLUMN IF NOT EXISTS "timeToPeakHours" INTEGER;

-- CreateTable
CREATE TABLE IF NOT EXISTS "KolPostSnapshot" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "capturedOn" DATE NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "comments" INTEGER NOT NULL DEFAULT 0,
    "shares" INTEGER NOT NULL DEFAULT 0,
    "saves" INTEGER NOT NULL DEFAULT 0,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KolPostSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "KolPostSyncRun" (
    "id" TEXT NOT NULL,
    "platform" "InfluencerPlatform" NOT NULL,
    "status" "KolSyncStatus" NOT NULL DEFAULT 'QUEUED',
    "apifyRunId" TEXT,
    "scheduleIds" TEXT[],
    "postUrls" TEXT[],
    "updated" INTEGER NOT NULL DEFAULT 0,
    "missing" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KolPostSyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "KolPlatformConfig" (
    "platform" "InfluencerPlatform" NOT NULL,
    "floorPct" INTEGER NOT NULL DEFAULT 80,
    "ceilingPct" INTEGER NOT NULL DEFAULT 120,
    "fypThreshold" INTEGER NOT NULL DEFAULT 1000000,
    "trackingDays" INTEGER NOT NULL DEFAULT 30,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KolPlatformConfig_pkey" PRIMARY KEY ("platform")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "KolReferenceCpm" (
    "platform" "InfluencerPlatform" NOT NULL,
    "tier" "InfluencerTier" NOT NULL,
    "cpm" DECIMAL(18,2) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KolReferenceCpm_pkey" PRIMARY KEY ("platform","tier")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "KolPostSnapshot_capturedOn_idx" ON "KolPostSnapshot"("capturedOn");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "KolPostSnapshot_scheduleId_capturedOn_key" ON "KolPostSnapshot"("scheduleId", "capturedOn");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "KolPostSyncRun_status_idx" ON "KolPostSyncRun"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "KolPostSyncRun_createdAt_idx" ON "KolPostSyncRun"("createdAt");

-- AddForeignKey
ALTER TABLE "KolPostSnapshot" ADD CONSTRAINT "KolPostSnapshot_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "KolSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

