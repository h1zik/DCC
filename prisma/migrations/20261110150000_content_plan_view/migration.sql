-- Content Plan sebagai view tambahan ruangan (RoomViewType.CONTENT_PLAN).
-- Aditif: baris & profil feed lama tetap ber-"viewId" NULL = content plan bawaan ruangan.
ALTER TYPE "RoomViewType" ADD VALUE IF NOT EXISTS 'CONTENT_PLAN';

ALTER TABLE "RoomContentPlanItem" ADD COLUMN "viewId" TEXT;
ALTER TABLE "RoomContentPlanFeedProfile" ADD COLUMN "viewId" TEXT;

-- Satu ruangan kini bisa punya beberapa profil feed (bawaan + per view),
-- jadi "roomId" tidak lagi unik; keunikan per view dijaga lewat "viewId".
DROP INDEX "RoomContentPlanFeedProfile_roomId_key";
CREATE INDEX "RoomContentPlanFeedProfile_roomId_idx" ON "RoomContentPlanFeedProfile"("roomId");
CREATE UNIQUE INDEX "RoomContentPlanFeedProfile_viewId_key" ON "RoomContentPlanFeedProfile"("viewId");
CREATE INDEX "RoomContentPlanItem_viewId_archivedAt_idx" ON "RoomContentPlanItem"("viewId", "archivedAt");

ALTER TABLE "RoomContentPlanItem"
  ADD CONSTRAINT "RoomContentPlanItem_viewId_fkey"
  FOREIGN KEY ("viewId") REFERENCES "RoomView"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RoomContentPlanFeedProfile"
  ADD CONSTRAINT "RoomContentPlanFeedProfile_viewId_fkey"
  FOREIGN KEY ("viewId") REFERENCES "RoomView"("id") ON DELETE CASCADE ON UPDATE CASCADE;
