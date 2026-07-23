-- Index performa (audit Jul 2026) — idempotent, aman dijalankan berulang.
-- Padanan deklarasinya ada di schema.prisma; skrip ini untuk DB yang belum
-- bisa `db push` karena drift lain. Nama index mengikuti konvensi Prisma
-- (Tabel_kolom_idx) supaya `db push` berikutnya tidak membuat duplikat.

CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Feed aktivitas lintas modul: filter window `createdAt >= since`.
CREATE INDEX IF NOT EXISTS "ScheduleEvent_createdAt_idx" ON "ScheduleEvent"("createdAt");
CREATE INDEX IF NOT EXISTS "FinanceJournalEntry_createdAt_idx" ON "FinanceJournalEntry"("createdAt");
CREATE INDEX IF NOT EXISTS "Task_createdAt_idx" ON "Task"("createdAt");
CREATE INDEX IF NOT EXISTS "StockLog_createdAt_idx" ON "StockLog"("createdAt");
CREATE INDEX IF NOT EXISTS "RoomDocument_createdAt_idx" ON "RoomDocument"("createdAt");

-- P&L per brand (finance dashboard + endpoint AI).
CREATE INDEX IF NOT EXISTS "FinanceJournalLine_brandId_idx" ON "FinanceJournalLine"("brandId");

-- Pencarian wiki: ILIKE '%q%' pakai GIN trigram.
CREATE INDEX IF NOT EXISTS "RoomWikiPage_title_idx" ON "RoomWikiPage" USING GIN ("title" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "RoomWikiPage_content_idx" ON "RoomWikiPage" USING GIN ("content" gin_trgm_ops);

-- Pencarian dokumen: kolom searchText mungkin belum ada di DB yang masih
-- drift — buat index hanya bila kolomnya sudah ada.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'RoomDocument' AND column_name = 'searchText'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS "RoomDocument_searchText_idx" ON "RoomDocument" USING GIN ("searchText" gin_trgm_ops)';
  END IF;
END $$;
