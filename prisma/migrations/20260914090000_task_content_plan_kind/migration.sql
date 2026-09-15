-- Tugas Kanban dari Content Planning kini bisa mewakili sisi copy ATAU design.
CREATE TYPE "ContentPlanTaskKind" AS ENUM ('COPYWRITING', 'DESIGN');

ALTER TABLE "Task" ADD COLUMN "contentPlanKind" "ContentPlanTaskKind";

-- Semua tugas lama yang tertaut baris Content Planning adalah tugas design.
UPDATE "Task" SET "contentPlanKind" = 'DESIGN'
WHERE "contentPlanItemId" IS NOT NULL AND "contentPlanKind" IS NULL;
