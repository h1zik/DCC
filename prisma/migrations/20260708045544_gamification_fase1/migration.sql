-- CreateEnum
CREATE TYPE "XpReason" AS ENUM ('ATTENDANCE', 'TASK_ONTIME', 'DATA_FRESH', 'ACHIEVEMENT', 'TENURE');

-- CreateEnum
CREATE TYPE "AchievementCategory" AS ENUM ('ATTENDANCE', 'TASK', 'DATA', 'SOCIAL', 'MILESTONE');

-- CreateEnum
CREATE TYPE "AchievementTier" AS ENUM ('BRONZE', 'SILVER', 'GOLD', 'PLATINUM');

-- CreateEnum
CREATE TYPE "CosmeticType" AS ENUM ('PROFILE_BACKGROUND', 'AVATAR_BORDER', 'NAMEPLATE', 'TITLE', 'ACCENT');

-- CreateEnum
CREATE TYPE "CosmeticRarity" AS ENUM ('COMMON', 'RARE', 'EPIC', 'LEGENDARY');

-- CreateEnum
CREATE TYPE "CosmeticUnlockType" AS ENUM ('FREE', 'LEVEL', 'ACHIEVEMENT', 'CUSTOM_UPLOAD');

-- CreateEnum
CREATE TYPE "CosmeticSource" AS ENUM ('DEFAULT', 'LEVEL', 'ACHIEVEMENT', 'UPLOAD');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'ACHIEVEMENT_UNLOCKED';

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "completedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "UserProgression" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "xpTotal" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 1,
    "attendanceStreak" INTEGER NOT NULL DEFAULT 0,
    "longestAttendanceStreak" INTEGER NOT NULL DEFAULT 0,
    "lastCheckinDate" VARCHAR(10),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProgression_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "XpLedger" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" "XpReason" NOT NULL,
    "refType" VARCHAR(32),
    "refId" VARCHAR(64),
    "dedupeKey" VARCHAR(180) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "XpLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Achievement" (
    "id" TEXT NOT NULL,
    "key" VARCHAR(64) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" VARCHAR(400) NOT NULL,
    "category" "AchievementCategory" NOT NULL,
    "tier" "AchievementTier" NOT NULL,
    "icon" VARCHAR(48) NOT NULL,
    "xpReward" INTEGER NOT NULL DEFAULT 0,
    "criteria" JSONB NOT NULL,
    "unlocksCosmeticKey" VARCHAR(64),
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Achievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserAchievement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "achievementId" TEXT NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "unlockedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserAchievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CosmeticItem" (
    "id" TEXT NOT NULL,
    "key" VARCHAR(64) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "type" "CosmeticType" NOT NULL,
    "rarity" "CosmeticRarity" NOT NULL DEFAULT 'COMMON',
    "previewRef" VARCHAR(120) NOT NULL,
    "styleConfig" JSONB NOT NULL,
    "unlockType" "CosmeticUnlockType" NOT NULL DEFAULT 'FREE',
    "unlockLevel" INTEGER,
    "unlockAchievementKey" VARCHAR(64),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CosmeticItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserCosmetic" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cosmeticItemId" TEXT NOT NULL,
    "source" "CosmeticSource" NOT NULL DEFAULT 'DEFAULT',
    "acquiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserCosmetic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserProfileConfig" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "equippedBackgroundId" TEXT,
    "equippedBorderId" TEXT,
    "equippedNameplateId" TEXT,
    "equippedTitleId" TEXT,
    "accentColor" VARCHAR(7),
    "customBackgroundUrl" VARCHAR(300),
    "customBorderColor" VARCHAR(7),
    "showcaseAchievementIds" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProfileConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserProgression_userId_key" ON "UserProgression"("userId");

-- CreateIndex
CREATE INDEX "UserProgression_level_idx" ON "UserProgression"("level");

-- CreateIndex
CREATE INDEX "UserProgression_xpTotal_idx" ON "UserProgression"("xpTotal");

-- CreateIndex
CREATE UNIQUE INDEX "XpLedger_dedupeKey_key" ON "XpLedger"("dedupeKey");

-- CreateIndex
CREATE INDEX "XpLedger_userId_createdAt_idx" ON "XpLedger"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "XpLedger_userId_reason_idx" ON "XpLedger"("userId", "reason");

-- CreateIndex
CREATE UNIQUE INDEX "Achievement_key_key" ON "Achievement"("key");

-- CreateIndex
CREATE INDEX "Achievement_category_tier_idx" ON "Achievement"("category", "tier");

-- CreateIndex
CREATE INDEX "Achievement_isActive_idx" ON "Achievement"("isActive");

-- CreateIndex
CREATE INDEX "UserAchievement_userId_unlockedAt_idx" ON "UserAchievement"("userId", "unlockedAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserAchievement_userId_achievementId_key" ON "UserAchievement"("userId", "achievementId");

-- CreateIndex
CREATE UNIQUE INDEX "CosmeticItem_key_key" ON "CosmeticItem"("key");

-- CreateIndex
CREATE INDEX "CosmeticItem_type_isActive_idx" ON "CosmeticItem"("type", "isActive");

-- CreateIndex
CREATE INDEX "CosmeticItem_unlockType_idx" ON "CosmeticItem"("unlockType");

-- CreateIndex
CREATE INDEX "UserCosmetic_userId_idx" ON "UserCosmetic"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserCosmetic_userId_cosmeticItemId_key" ON "UserCosmetic"("userId", "cosmeticItemId");

-- CreateIndex
CREATE UNIQUE INDEX "UserProfileConfig_userId_key" ON "UserProfileConfig"("userId");

-- AddForeignKey
ALTER TABLE "UserProgression" ADD CONSTRAINT "UserProgression_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "XpLedger" ADD CONSTRAINT "XpLedger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAchievement" ADD CONSTRAINT "UserAchievement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAchievement" ADD CONSTRAINT "UserAchievement_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "Achievement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCosmetic" ADD CONSTRAINT "UserCosmetic_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCosmetic" ADD CONSTRAINT "UserCosmetic_cosmeticItemId_fkey" FOREIGN KEY ("cosmeticItemId") REFERENCES "CosmeticItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProfileConfig" ADD CONSTRAINT "UserProfileConfig_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
