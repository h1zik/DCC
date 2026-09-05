-- Simulasi feed Instagram di Content Plan: profil tiruan per ruangan + cover/sembunyi per baris.
ALTER TABLE "RoomContentPlanItem"
  ADD COLUMN "feedCoverIndex" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "feedCoverPath" TEXT,
  ADD COLUMN "hiddenFromFeed" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "RoomContentPlanFeedProfile" (
  "id" TEXT NOT NULL,
  "roomId" TEXT NOT NULL,
  "username" VARCHAR(60) NOT NULL DEFAULT '',
  "displayName" VARCHAR(80) NOT NULL DEFAULT '',
  "bio" VARCHAR(400) NOT NULL DEFAULT '',
  "avatarPath" TEXT,
  "followersLabel" VARCHAR(20) NOT NULL DEFAULT '12,4K',
  "followingLabel" VARCHAR(20) NOT NULL DEFAULT '180',
  "includeArchived" BOOLEAN NOT NULL DEFAULT true,
  "instagramOnly" BOOLEAN NOT NULL DEFAULT true,
  "includeUndated" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RoomContentPlanFeedProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RoomContentPlanFeedProfile_roomId_key" ON "RoomContentPlanFeedProfile"("roomId");

ALTER TABLE "RoomContentPlanFeedProfile"
  ADD CONSTRAINT "RoomContentPlanFeedProfile_roomId_fkey"
  FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
