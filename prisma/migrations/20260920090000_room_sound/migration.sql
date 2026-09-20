-- Suara kustom soundboard voice call (per ruangan).
CREATE TABLE "RoomSound" (
  "id" TEXT NOT NULL,
  "roomId" TEXT NOT NULL,
  "name" VARCHAR(32) NOT NULL,
  "emoji" VARCHAR(16),
  "publicPath" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "durationMs" INTEGER NOT NULL,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RoomSound_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RoomSound_roomId_createdAt_idx" ON "RoomSound"("roomId", "createdAt");

ALTER TABLE "RoomSound" ADD CONSTRAINT "RoomSound_roomId_fkey"
  FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RoomSound" ADD CONSTRAINT "RoomSound_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
