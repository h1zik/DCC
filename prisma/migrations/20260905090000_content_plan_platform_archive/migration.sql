-- Platform tayang (multi) + arsip baris content planning.
CREATE TYPE "ContentPlanPlatform" AS ENUM ('INSTAGRAM', 'TIKTOK', 'THREADS', 'FACEBOOK', 'YOUTUBE', 'X', 'LINKEDIN');

ALTER TABLE "RoomContentPlanItem"
  ADD COLUMN "platforms" "ContentPlanPlatform"[] DEFAULT ARRAY[]::"ContentPlanPlatform"[],
  ADD COLUMN "archivedAt" TIMESTAMP(3);

CREATE INDEX "RoomContentPlanItem_roomId_archivedAt_idx" ON "RoomContentPlanItem"("roomId", "archivedAt");
