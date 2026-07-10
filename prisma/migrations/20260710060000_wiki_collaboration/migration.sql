ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'WIKI_MENTION';

ALTER TABLE "RoomWikiPage"
ADD COLUMN "editLockedById" TEXT,
ADD COLUMN "editLockExpiresAt" TIMESTAMP(3);

CREATE TABLE "RoomWikiComment" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "mentionedUserIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RoomWikiComment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RoomWikiPresence" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RoomWikiPresence_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RoomWikiComment_pageId_resolvedAt_createdAt_idx"
ON "RoomWikiComment"("pageId", "resolvedAt", "createdAt");
CREATE UNIQUE INDEX "RoomWikiPresence_pageId_userId_key"
ON "RoomWikiPresence"("pageId", "userId");
CREATE INDEX "RoomWikiPresence_pageId_lastSeenAt_idx"
ON "RoomWikiPresence"("pageId", "lastSeenAt");

ALTER TABLE "RoomWikiPage" ADD CONSTRAINT "RoomWikiPage_editLockedById_fkey"
FOREIGN KEY ("editLockedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RoomWikiComment" ADD CONSTRAINT "RoomWikiComment_pageId_fkey"
FOREIGN KEY ("pageId") REFERENCES "RoomWikiPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoomWikiComment" ADD CONSTRAINT "RoomWikiComment_authorId_fkey"
FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoomWikiPresence" ADD CONSTRAINT "RoomWikiPresence_pageId_fkey"
FOREIGN KEY ("pageId") REFERENCES "RoomWikiPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoomWikiPresence" ADD CONSTRAINT "RoomWikiPresence_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
