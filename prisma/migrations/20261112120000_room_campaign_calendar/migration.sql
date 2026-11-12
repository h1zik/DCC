-- Kalender ruangan untuk campaign brand: entitas campaign + jenis aktivitas.
-- Aditif: acara lama tetap utuh ("kind" default GENERAL, "campaignId" NULL).
CREATE TYPE "RoomCampaignStatus" AS ENUM ('PLANNED', 'ACTIVE', 'PAUSED', 'DONE');
CREATE TYPE "RoomCalendarEventKind" AS ENUM ('GENERAL', 'SHOOT', 'CONTENT', 'LIVE', 'PROMO', 'KOL', 'LAUNCH', 'OFFLINE', 'MEETING', 'DEADLINE');

CREATE TABLE "RoomCampaign" (
    "id" TEXT NOT NULL,
    "viewId" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "color" VARCHAR(16) NOT NULL,
    "status" "RoomCampaignStatus" NOT NULL DEFAULT 'PLANNED',
    "objective" "ContentPlanUsage",
    "channels" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "picUserIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "budget" DECIMAL(18,2),
    "kpiTarget" VARCHAR(500),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoomCampaign_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "RoomCalendarEvent" ADD COLUMN "campaignId" TEXT;
ALTER TABLE "RoomCalendarEvent" ADD COLUMN "kind" "RoomCalendarEventKind" NOT NULL DEFAULT 'GENERAL';
ALTER TABLE "RoomCalendarEvent" ADD COLUMN "doneAt" TIMESTAMP(3);

CREATE INDEX "RoomCampaign_viewId_startDate_idx" ON "RoomCampaign"("viewId", "startDate");
CREATE INDEX "RoomCalendarEvent_campaignId_idx" ON "RoomCalendarEvent"("campaignId");

ALTER TABLE "RoomCampaign"
  ADD CONSTRAINT "RoomCampaign_viewId_fkey"
  FOREIGN KEY ("viewId") REFERENCES "RoomView"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RoomCalendarEvent"
  ADD CONSTRAINT "RoomCalendarEvent_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "RoomCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
