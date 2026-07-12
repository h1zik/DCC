-- CreateTable
CREATE TABLE "PersonalNote" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "parentId" TEXT,
    "title" VARCHAR(160) NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "revision" INTEGER NOT NULL DEFAULT 0,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonalNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonalKanbanColumn" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "title" VARCHAR(80) NOT NULL,
    "colorHex" VARCHAR(7),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonalKanbanColumn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonalKanbanCard" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "columnId" TEXT NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "dueDate" TIMESTAMP(3),
    "isDone" BOOLEAN NOT NULL DEFAULT false,
    "sortKey" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonalKanbanCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonalBookmark" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "url" VARCHAR(800) NOT NULL,
    "description" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonalBookmark_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonalFileFolder" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "parentId" TEXT,
    "name" VARCHAR(120) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PersonalFileFolder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonalFile" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "folderId" TEXT,
    "fileName" VARCHAR(240) NOT NULL,
    "mimeType" VARCHAR(160) NOT NULL,
    "size" INTEGER NOT NULL,
    "storagePath" VARCHAR(500) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PersonalFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PersonalNote_ownerId_parentId_sortOrder_idx" ON "PersonalNote"("ownerId", "parentId", "sortOrder");

-- CreateIndex
CREATE INDEX "PersonalNote_ownerId_updatedAt_idx" ON "PersonalNote"("ownerId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "PersonalKanbanColumn_ownerId_sortOrder_idx" ON "PersonalKanbanColumn"("ownerId", "sortOrder");

-- CreateIndex
CREATE INDEX "PersonalKanbanCard_columnId_sortKey_idx" ON "PersonalKanbanCard"("columnId", "sortKey");

-- CreateIndex
CREATE INDEX "PersonalKanbanCard_ownerId_isDone_dueDate_idx" ON "PersonalKanbanCard"("ownerId", "isDone", "dueDate");

-- CreateIndex
CREATE INDEX "PersonalBookmark_ownerId_sortOrder_idx" ON "PersonalBookmark"("ownerId", "sortOrder");

-- CreateIndex
CREATE INDEX "PersonalFileFolder_ownerId_parentId_idx" ON "PersonalFileFolder"("ownerId", "parentId");

-- CreateIndex
CREATE UNIQUE INDEX "PersonalFileFolder_ownerId_parentId_name_key" ON "PersonalFileFolder"("ownerId", "parentId", "name");

-- CreateIndex
CREATE INDEX "PersonalFile_ownerId_folderId_createdAt_idx" ON "PersonalFile"("ownerId", "folderId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "PersonalNote" ADD CONSTRAINT "PersonalNote_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalNote" ADD CONSTRAINT "PersonalNote_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "PersonalNote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalKanbanColumn" ADD CONSTRAINT "PersonalKanbanColumn_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalKanbanCard" ADD CONSTRAINT "PersonalKanbanCard_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalKanbanCard" ADD CONSTRAINT "PersonalKanbanCard_columnId_fkey" FOREIGN KEY ("columnId") REFERENCES "PersonalKanbanColumn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalBookmark" ADD CONSTRAINT "PersonalBookmark_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalFileFolder" ADD CONSTRAINT "PersonalFileFolder_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalFileFolder" ADD CONSTRAINT "PersonalFileFolder_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "PersonalFileFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalFile" ADD CONSTRAINT "PersonalFile_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalFile" ADD CONSTRAINT "PersonalFile_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "PersonalFileFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

