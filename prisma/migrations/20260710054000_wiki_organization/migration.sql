ALTER TABLE "RoomWikiPage"
ADD COLUMN "parentId" TEXT,
ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE INDEX "RoomWikiPage_viewId_parentId_sortOrder_idx"
ON "RoomWikiPage"("viewId", "parentId", "sortOrder");

ALTER TABLE "RoomWikiPage"
ADD CONSTRAINT "RoomWikiPage_parentId_fkey"
FOREIGN KEY ("parentId") REFERENCES "RoomWikiPage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
