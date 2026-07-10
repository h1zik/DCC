ALTER TABLE "RoomWikiPage"
ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "RoomWikiPageVersion" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "content" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "reason" VARCHAR(32) NOT NULL DEFAULT 'autosave',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoomWikiPageVersion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RoomWikiPageVersion_pageId_revision_key"
ON "RoomWikiPageVersion"("pageId", "revision");

CREATE INDEX "RoomWikiPageVersion_pageId_createdAt_idx"
ON "RoomWikiPageVersion"("pageId", "createdAt" DESC);

ALTER TABLE "RoomWikiPageVersion"
ADD CONSTRAINT "RoomWikiPageVersion_pageId_fkey"
FOREIGN KEY ("pageId") REFERENCES "RoomWikiPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RoomWikiPageVersion"
ADD CONSTRAINT "RoomWikiPageVersion_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "RoomWikiPageVersion"
    ("id", "pageId", "revision", "title", "content", "createdById", "reason", "createdAt")
SELECT
    'wikiver_' || md5(p."id"),
    p."id",
    0,
    p."title",
    p."content",
    COALESCE(
      p."updatedById",
      (
        SELECT rm."userId"
        FROM "RoomMember" rm
        JOIN "RoomView" rv ON rv."roomId" = rm."roomId"
        WHERE rv."id" = p."viewId"
        ORDER BY rm."createdAt" ASC
        LIMIT 1
      )
    ),
    'initial',
    p."updatedAt"
FROM "RoomWikiPage" p
WHERE COALESCE(
  p."updatedById",
  (
    SELECT rm."userId"
    FROM "RoomMember" rm
    JOIN "RoomView" rv ON rv."roomId" = rm."roomId"
    WHERE rv."id" = p."viewId"
    ORDER BY rm."createdAt" ASC
    LIMIT 1
  )
) IS NOT NULL;
