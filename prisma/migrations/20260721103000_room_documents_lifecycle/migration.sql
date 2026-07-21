ALTER TABLE "RoomDocumentFolder"
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "trashedAt" TIMESTAMP(3),
ADD COLUMN "trashedById" TEXT;

ALTER TABLE "RoomDocument"
ADD COLUMN "searchText" TEXT,
ADD COLUMN "currentVersion" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "trashedAt" TIMESTAMP(3),
ADD COLUMN "trashedById" TEXT,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE "RoomDocumentVersion" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "publicPath" TEXT NOT NULL,
    "thumbPath" TEXT,
    "uploadedById" TEXT NOT NULL,
    "note" VARCHAR(240),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RoomDocumentVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RoomDocumentFavorite" (
    "documentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RoomDocumentFavorite_pkey" PRIMARY KEY ("documentId", "userId")
);

CREATE TABLE "RoomDocumentFolderFavorite" (
    "folderId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RoomDocumentFolderFavorite_pkey" PRIMARY KEY ("folderId", "userId")
);

CREATE TABLE "RoomDocumentActivity" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "documentId" TEXT,
    "folderId" TEXT,
    "actorId" TEXT NOT NULL,
    "action" VARCHAR(40) NOT NULL,
    "targetName" VARCHAR(240) NOT NULL,
    "detail" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RoomDocumentActivity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RoomDocumentShare" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "recipientId" TEXT,
    "token" TEXT,
    "role" VARCHAR(16) NOT NULL DEFAULT 'VIEWER',
    "expiresAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RoomDocumentShare_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RoomDocumentFolderShare" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "folderId" TEXT NOT NULL,
    "recipientId" TEXT,
    "token" TEXT,
    "role" VARCHAR(16) NOT NULL DEFAULT 'VIEWER',
    "expiresAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RoomDocumentFolderShare_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RoomDocumentVersion_documentId_version_key" ON "RoomDocumentVersion"("documentId", "version");
CREATE INDEX "RoomDocumentVersion_documentId_createdAt_idx" ON "RoomDocumentVersion"("documentId", "createdAt" DESC);
CREATE INDEX "RoomDocumentFavorite_userId_createdAt_idx" ON "RoomDocumentFavorite"("userId", "createdAt" DESC);
CREATE INDEX "RoomDocumentFolderFavorite_userId_createdAt_idx" ON "RoomDocumentFolderFavorite"("userId", "createdAt" DESC);
CREATE INDEX "RoomDocumentActivity_roomId_createdAt_idx" ON "RoomDocumentActivity"("roomId", "createdAt" DESC);
CREATE INDEX "RoomDocumentActivity_documentId_createdAt_idx" ON "RoomDocumentActivity"("documentId", "createdAt" DESC);
CREATE INDEX "RoomDocumentActivity_folderId_createdAt_idx" ON "RoomDocumentActivity"("folderId", "createdAt" DESC);
CREATE UNIQUE INDEX "RoomDocumentShare_token_key" ON "RoomDocumentShare"("token");
CREATE UNIQUE INDEX "RoomDocumentShare_documentId_recipientId_key" ON "RoomDocumentShare"("documentId", "recipientId");
CREATE INDEX "RoomDocumentShare_roomId_recipientId_idx" ON "RoomDocumentShare"("roomId", "recipientId");
CREATE UNIQUE INDEX "RoomDocumentFolderShare_token_key" ON "RoomDocumentFolderShare"("token");
CREATE UNIQUE INDEX "RoomDocumentFolderShare_folderId_recipientId_key" ON "RoomDocumentFolderShare"("folderId", "recipientId");
CREATE INDEX "RoomDocumentFolderShare_roomId_recipientId_idx" ON "RoomDocumentFolderShare"("roomId", "recipientId");
CREATE INDEX "RoomDocumentFolder_roomId_trashedAt_idx" ON "RoomDocumentFolder"("roomId", "trashedAt");
CREATE INDEX "RoomDocument_roomId_trashedAt_createdAt_idx" ON "RoomDocument"("roomId", "trashedAt", "createdAt" DESC);

ALTER TABLE "RoomDocumentFolder" ADD CONSTRAINT "RoomDocumentFolder_trashedById_fkey" FOREIGN KEY ("trashedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RoomDocument" ADD CONSTRAINT "RoomDocument_trashedById_fkey" FOREIGN KEY ("trashedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RoomDocumentVersion" ADD CONSTRAINT "RoomDocumentVersion_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "RoomDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoomDocumentVersion" ADD CONSTRAINT "RoomDocumentVersion_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RoomDocumentFavorite" ADD CONSTRAINT "RoomDocumentFavorite_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "RoomDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoomDocumentFavorite" ADD CONSTRAINT "RoomDocumentFavorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoomDocumentFolderFavorite" ADD CONSTRAINT "RoomDocumentFolderFavorite_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "RoomDocumentFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoomDocumentFolderFavorite" ADD CONSTRAINT "RoomDocumentFolderFavorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoomDocumentActivity" ADD CONSTRAINT "RoomDocumentActivity_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoomDocumentActivity" ADD CONSTRAINT "RoomDocumentActivity_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "RoomDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RoomDocumentActivity" ADD CONSTRAINT "RoomDocumentActivity_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "RoomDocumentFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RoomDocumentActivity" ADD CONSTRAINT "RoomDocumentActivity_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RoomDocumentShare" ADD CONSTRAINT "RoomDocumentShare_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoomDocumentShare" ADD CONSTRAINT "RoomDocumentShare_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "RoomDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoomDocumentShare" ADD CONSTRAINT "RoomDocumentShare_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoomDocumentShare" ADD CONSTRAINT "RoomDocumentShare_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RoomDocumentFolderShare" ADD CONSTRAINT "RoomDocumentFolderShare_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoomDocumentFolderShare" ADD CONSTRAINT "RoomDocumentFolderShare_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "RoomDocumentFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoomDocumentFolderShare" ADD CONSTRAINT "RoomDocumentFolderShare_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoomDocumentFolderShare" ADD CONSTRAINT "RoomDocumentFolderShare_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "RoomDocumentVersion" ("id", "documentId", "version", "fileName", "mimeType", "size", "publicPath", "thumbPath", "uploadedById", "note", "createdAt")
SELECT 'docver_' || md5(d."id"), d."id", 1, d."fileName", d."mimeType", d."size", d."publicPath", d."thumbPath", d."uploadedById", 'Versi awal', d."createdAt"
FROM "RoomDocument" d;
