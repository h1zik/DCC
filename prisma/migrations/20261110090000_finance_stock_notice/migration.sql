-- Notifikasi mutasi stok Inventori → Finance — ADITIF SAJA. Tidak mengubah
-- atau menyentuh baris tabel Finance / StockLog yang sudah ada: hanya satu
-- nilai enum baru + satu tabel baru. Mutasi stok lama TIDAK di-backfill.

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'STOCK_MOVEMENT';

-- CreateTable
CREATE TABLE IF NOT EXISTS "FinanceStockNotice" (
    "id" TEXT NOT NULL,
    "stockLogId" TEXT NOT NULL,
    "journalEntryId" TEXT,
    "dismissedAt" TIMESTAMP(3),
    "dismissNote" VARCHAR(300),
    "handledById" TEXT,
    "handledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinanceStockNotice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "FinanceStockNotice_stockLogId_key" ON "FinanceStockNotice"("stockLogId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FinanceStockNotice_journalEntryId_idx" ON "FinanceStockNotice"("journalEntryId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FinanceStockNotice_dismissedAt_createdAt_idx" ON "FinanceStockNotice"("dismissedAt", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "FinanceStockNotice" ADD CONSTRAINT "FinanceStockNotice_stockLogId_fkey" FOREIGN KEY ("stockLogId") REFERENCES "StockLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceStockNotice" ADD CONSTRAINT "FinanceStockNotice_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "FinanceJournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceStockNotice" ADD CONSTRAINT "FinanceStockNotice_handledById_fkey" FOREIGN KEY ("handledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
