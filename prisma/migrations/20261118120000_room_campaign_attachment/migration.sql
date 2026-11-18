-- Lampiran campaign di kalender ruangan (file unggahan atau tautan).
-- Aditif: hanya tabel baru, tidak menyentuh data yang sudah ada.
CREATE TABLE "RoomCampaignAttachment" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "uploadedById" TEXT,
    "fileName" VARCHAR(240) NOT NULL,
    "mimeType" VARCHAR(160) NOT NULL,
    "size" INTEGER NOT NULL DEFAULT 0,
    "storagePath" VARCHAR(800),
    "linkUrl" VARCHAR(2048),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoomCampaignAttachment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RoomCampaignAttachment_campaignId_createdAt_idx" ON "RoomCampaignAttachment"("campaignId", "createdAt");

ALTER TABLE "RoomCampaignAttachment"
  ADD CONSTRAINT "RoomCampaignAttachment_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "RoomCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
