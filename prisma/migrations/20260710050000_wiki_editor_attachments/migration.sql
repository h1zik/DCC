CREATE TABLE "RoomWikiAttachment" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "fileName" VARCHAR(240) NOT NULL,
    "mimeType" VARCHAR(160) NOT NULL,
    "size" INTEGER NOT NULL,
    "publicPath" VARCHAR(800) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoomWikiAttachment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RoomWikiAttachment_pageId_createdAt_idx"
ON "RoomWikiAttachment"("pageId", "createdAt");

ALTER TABLE "RoomWikiAttachment"
ADD CONSTRAINT "RoomWikiAttachment_pageId_fkey"
FOREIGN KEY ("pageId") REFERENCES "RoomWikiPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RoomWikiAttachment"
ADD CONSTRAINT "RoomWikiAttachment_uploadedById_fkey"
FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
