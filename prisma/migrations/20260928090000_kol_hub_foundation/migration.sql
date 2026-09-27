-- KOL Hub fase 1 — ADITIF SAJA: enum & tabel baru, 2 nilai NotificationType,
-- dan satu kolom nullable Product.retailPrice. Tidak mengubah/menghapus data lama.
-- Default master data (endorse type "Barter") dibuat idempoten oleh aplikasi.

-- CreateEnum
CREATE TYPE "KolStatus" AS ENUM ('WAITING_APPROVAL', 'ACTIVE', 'BLACKLISTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "KolChangeType" AS ENUM ('CREATE', 'EDIT', 'BLACKLIST', 'UNBLACKLIST');

-- CreateEnum
CREATE TYPE "KolChangeStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "KolPlacement" AS ENUM ('FEED', 'REELS', 'STORY', 'CAROUSEL', 'VIDEO', 'LIVE');

-- CreateEnum
CREATE TYPE "KolObjective" AS ENUM ('AWARENESS', 'CONSIDERATION', 'CONVERSION');

-- CreateEnum
CREATE TYPE "KolScheduleStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SCHEDULED', 'POSTED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "KolPostStatus" AS ENUM ('NOT_POSTED', 'POSTED', 'TAKEN_DOWN');

-- CreateEnum
CREATE TYPE "KolShipmentStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'SHIPPED', 'DELIVERED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'KOL_APPROVAL_REQUEST';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'KOL_APPROVAL_DECIDED';

-- AlterTable
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "retailPrice" DECIMAL(18,2);

-- CreateTable
CREATE TABLE IF NOT EXISTS "KolProfile" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "birthDate" DATE,
    "notes" TEXT,
    "addressLine" TEXT,
    "district" TEXT,
    "city" TEXT,
    "province" TEXT,
    "postalCode" TEXT,
    "bankCode" TEXT,
    "bankName" TEXT,
    "bankBranch" TEXT,
    "accountHolder" TEXT,
    "accountNumber" TEXT,
    "status" "KolStatus" NOT NULL DEFAULT 'WAITING_APPROVAL',
    "blacklistReason" TEXT,
    "createdById" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KolProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "KolCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KolCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "KolProfileCategory" (
    "kolId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,

    CONSTRAINT "KolProfileCategory_pkey" PRIMARY KEY ("kolId","categoryId")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "KolSocialAccount" (
    "id" TEXT NOT NULL,
    "kolId" TEXT NOT NULL,
    "platform" "InfluencerPlatform" NOT NULL,
    "handle" TEXT NOT NULL,
    "profileUrl" TEXT NOT NULL,
    "rateCard" DECIMAL(18,2),
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "influencerProfileId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KolSocialAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "KolProfileChangeRequest" (
    "id" TEXT NOT NULL,
    "kolId" TEXT NOT NULL,
    "type" "KolChangeType" NOT NULL,
    "payload" JSONB,
    "reason" TEXT,
    "status" "KolChangeStatus" NOT NULL DEFAULT 'PENDING',
    "requestedById" TEXT,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KolProfileChangeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "KolEndorseType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isBarter" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KolEndorseType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "KolBrief" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "categoryId" TEXT,
    "title" TEXT NOT NULL,
    "linkUrl" TEXT,
    "description" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KolBrief_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "KolBudget" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "beginningBalance" DECIMAL(18,2) NOT NULL,
    "notes" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KolBudget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "KolCampaign" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "budgetId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startDate" DATE,
    "endDate" DATE,
    "picUserId" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KolCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "KolScheduleOrder" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "kolId" TEXT NOT NULL,
    "note" TEXT,
    "requestedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KolScheduleOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "KolSchedule" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "subNumber" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "kolId" TEXT NOT NULL,
    "socialAccountId" TEXT NOT NULL,
    "placement" "KolPlacement" NOT NULL,
    "endorseTypeId" TEXT NOT NULL,
    "objective" "KolObjective" NOT NULL,
    "scheduledAt" TIMESTAMP(3),
    "briefId" TEXT,
    "picUserId" TEXT,
    "rate" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "additionalCost" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "status" "KolScheduleStatus" NOT NULL DEFAULT 'DRAFT',
    "requestedById" TEXT,
    "submittedAt" TIMESTAMP(3),
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "postStatus" "KolPostStatus" NOT NULL DEFAULT 'NOT_POSTED',
    "postUrl" TEXT,
    "postedAt" TIMESTAMP(3),
    "shipmentStatus" "KolShipmentStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
    "courier" TEXT,
    "trackingNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KolSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "KolScheduleProduct" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitValue" DECIMAL(18,2),

    CONSTRAINT "KolScheduleProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "KolAuditEvent" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KolAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "KolCounter" (
    "key" TEXT NOT NULL,
    "lastSeq" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "KolCounter_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "KolProfile_status_idx" ON "KolProfile"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "KolProfile_fullName_idx" ON "KolProfile"("fullName");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "KolProfile_createdById_idx" ON "KolProfile"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "KolCategory_name_key" ON "KolCategory"("name");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "KolProfileCategory_categoryId_idx" ON "KolProfileCategory"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "KolSocialAccount_influencerProfileId_key" ON "KolSocialAccount"("influencerProfileId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "KolSocialAccount_kolId_idx" ON "KolSocialAccount"("kolId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "KolSocialAccount_platform_handle_key" ON "KolSocialAccount"("platform", "handle");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "KolProfileChangeRequest_status_idx" ON "KolProfileChangeRequest"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "KolProfileChangeRequest_kolId_status_idx" ON "KolProfileChangeRequest"("kolId", "status");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "KolEndorseType_name_key" ON "KolEndorseType"("name");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "KolBrief_brandId_idx" ON "KolBrief"("brandId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "KolBudget_brandId_idx" ON "KolBudget"("brandId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "KolCampaign_brandId_idx" ON "KolCampaign"("brandId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "KolCampaign_budgetId_idx" ON "KolCampaign"("budgetId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "KolScheduleOrder_orderNumber_key" ON "KolScheduleOrder"("orderNumber");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "KolScheduleOrder_campaignId_idx" ON "KolScheduleOrder"("campaignId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "KolScheduleOrder_kolId_idx" ON "KolScheduleOrder"("kolId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "KolSchedule_subNumber_key" ON "KolSchedule"("subNumber");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "KolSchedule_status_idx" ON "KolSchedule"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "KolSchedule_scheduledAt_idx" ON "KolSchedule"("scheduledAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "KolSchedule_campaignId_idx" ON "KolSchedule"("campaignId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "KolSchedule_kolId_idx" ON "KolSchedule"("kolId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "KolSchedule_orderId_idx" ON "KolSchedule"("orderId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "KolSchedule_brandId_scheduledAt_idx" ON "KolSchedule"("brandId", "scheduledAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "KolScheduleProduct_productId_idx" ON "KolScheduleProduct"("productId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "KolScheduleProduct_scheduleId_productId_key" ON "KolScheduleProduct"("scheduleId", "productId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "KolAuditEvent_entityType_entityId_idx" ON "KolAuditEvent"("entityType", "entityId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "KolAuditEvent_createdAt_idx" ON "KolAuditEvent"("createdAt");

-- AddForeignKey
ALTER TABLE "KolProfile" ADD CONSTRAINT "KolProfile_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KolProfile" ADD CONSTRAINT "KolProfile_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KolProfileCategory" ADD CONSTRAINT "KolProfileCategory_kolId_fkey" FOREIGN KEY ("kolId") REFERENCES "KolProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KolProfileCategory" ADD CONSTRAINT "KolProfileCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "KolCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KolSocialAccount" ADD CONSTRAINT "KolSocialAccount_kolId_fkey" FOREIGN KEY ("kolId") REFERENCES "KolProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KolSocialAccount" ADD CONSTRAINT "KolSocialAccount_influencerProfileId_fkey" FOREIGN KEY ("influencerProfileId") REFERENCES "InfluencerProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KolProfileChangeRequest" ADD CONSTRAINT "KolProfileChangeRequest_kolId_fkey" FOREIGN KEY ("kolId") REFERENCES "KolProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KolProfileChangeRequest" ADD CONSTRAINT "KolProfileChangeRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KolProfileChangeRequest" ADD CONSTRAINT "KolProfileChangeRequest_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KolBrief" ADD CONSTRAINT "KolBrief_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KolBrief" ADD CONSTRAINT "KolBrief_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "KolCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KolBudget" ADD CONSTRAINT "KolBudget_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KolBudget" ADD CONSTRAINT "KolBudget_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KolCampaign" ADD CONSTRAINT "KolCampaign_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KolCampaign" ADD CONSTRAINT "KolCampaign_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "KolBudget"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KolCampaign" ADD CONSTRAINT "KolCampaign_picUserId_fkey" FOREIGN KEY ("picUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KolScheduleOrder" ADD CONSTRAINT "KolScheduleOrder_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KolScheduleOrder" ADD CONSTRAINT "KolScheduleOrder_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "KolCampaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KolScheduleOrder" ADD CONSTRAINT "KolScheduleOrder_kolId_fkey" FOREIGN KEY ("kolId") REFERENCES "KolProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KolScheduleOrder" ADD CONSTRAINT "KolScheduleOrder_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KolSchedule" ADD CONSTRAINT "KolSchedule_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "KolScheduleOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KolSchedule" ADD CONSTRAINT "KolSchedule_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KolSchedule" ADD CONSTRAINT "KolSchedule_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "KolCampaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KolSchedule" ADD CONSTRAINT "KolSchedule_kolId_fkey" FOREIGN KEY ("kolId") REFERENCES "KolProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KolSchedule" ADD CONSTRAINT "KolSchedule_socialAccountId_fkey" FOREIGN KEY ("socialAccountId") REFERENCES "KolSocialAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KolSchedule" ADD CONSTRAINT "KolSchedule_endorseTypeId_fkey" FOREIGN KEY ("endorseTypeId") REFERENCES "KolEndorseType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KolSchedule" ADD CONSTRAINT "KolSchedule_briefId_fkey" FOREIGN KEY ("briefId") REFERENCES "KolBrief"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KolSchedule" ADD CONSTRAINT "KolSchedule_picUserId_fkey" FOREIGN KEY ("picUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KolSchedule" ADD CONSTRAINT "KolSchedule_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KolSchedule" ADD CONSTRAINT "KolSchedule_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KolScheduleProduct" ADD CONSTRAINT "KolScheduleProduct_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "KolSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KolScheduleProduct" ADD CONSTRAINT "KolScheduleProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KolAuditEvent" ADD CONSTRAINT "KolAuditEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

