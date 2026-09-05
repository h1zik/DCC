-- Simulasi feed: keikutsertaan tiga status (AUTO/SHOWN/HIDDEN) + posisi manual grid.
-- Menggantikan kolom boolean hiddenFromFeed dari migrasi 20260906090000.
CREATE TYPE "ContentPlanFeedVisibility" AS ENUM ('AUTO', 'SHOWN', 'HIDDEN');

ALTER TABLE "RoomContentPlanItem"
  ADD COLUMN "feedVisibility" "ContentPlanFeedVisibility" NOT NULL DEFAULT 'AUTO',
  ADD COLUMN "feedPosition" INTEGER;

UPDATE "RoomContentPlanItem"
  SET "feedVisibility" = 'HIDDEN'
  WHERE "hiddenFromFeed" = true;

ALTER TABLE "RoomContentPlanItem" DROP COLUMN "hiddenFromFeed";
