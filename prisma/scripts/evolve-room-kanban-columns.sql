-- Siapkan RoomKanbanColumn sebelum db push: isi kind/coreRole, gabung duplikat.
-- Idempotent — aman dijalankan ulang.

DO $$
DECLARE
  dup RECORD;
  keeper_id TEXT;
  drop_id TEXT;
  drop_ids TEXT[];
BEGIN
  -- Tambah kolom kind / coreRole jika db push belum jalan (production lama).
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'KanbanColumnKind'
  ) THEN
    CREATE TYPE "KanbanColumnKind" AS ENUM ('CORE', 'CUSTOM');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'RoomKanbanColumn'
      AND column_name = 'kind'
  ) THEN
    ALTER TABLE "RoomKanbanColumn"
      ADD COLUMN "kind" "KanbanColumnKind" NOT NULL DEFAULT 'CUSTOM';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'RoomKanbanColumn'
      AND column_name = 'coreRole'
  ) THEN
    ALTER TABLE "RoomKanbanColumn" ADD COLUMN "coreRole" "TaskStatus";
  END IF;

  -- Kolom inti: kind CORE + coreRole = linkedStatus untuk status utama.
  UPDATE "RoomKanbanColumn"
  SET
    "kind" = 'CORE',
    "coreRole" = "linkedStatus"
  WHERE "linkedStatus" IN ('TODO', 'IN_PROGRESS', 'OVERDUE', 'DONE')
    AND ("coreRole" IS NULL OR "kind" = 'CUSTOM');

  -- Kolom opsional (BLOCKED, IN_REVIEW, dll.): CUSTOM tanpa coreRole.
  UPDATE "RoomKanbanColumn"
  SET
    "kind" = 'CUSTOM',
    "coreRole" = NULL
  WHERE "linkedStatus" NOT IN ('TODO', 'IN_PROGRESS', 'OVERDUE', 'DONE')
    AND "coreRole" IS NOT NULL;

  -- Gabung duplikat (roomId, roomProcess, customProcessPhaseId, coreRole).
  FOR dup IN
    SELECT
      "roomId",
      "roomProcess",
      "customProcessPhaseId",
      "coreRole",
      array_agg(id ORDER BY "sortOrder", "createdAt", id) AS ids
    FROM "RoomKanbanColumn"
    WHERE "coreRole" IS NOT NULL
    GROUP BY "roomId", "roomProcess", "customProcessPhaseId", "coreRole"
    HAVING count(*) > 1
  LOOP
    keeper_id := dup.ids[1];
    drop_ids := dup.ids[2:array_length(dup.ids, 1)];

    IF drop_ids IS NULL THEN
      CONTINUE;
    END IF;

    FOREACH drop_id IN ARRAY drop_ids LOOP
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'Task'
          AND column_name = 'kanbanColumnId'
      ) THEN
        UPDATE "Task"
        SET "kanbanColumnId" = keeper_id
        WHERE "kanbanColumnId" = drop_id;
      END IF;

      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'TaskKanbanPosition'
          AND column_name = 'columnId'
      ) THEN
        UPDATE "TaskKanbanPosition"
        SET "columnId" = keeper_id
        WHERE "columnId" = drop_id;

        DELETE FROM "TaskKanbanPosition" tkp
        USING "TaskKanbanPosition" other
        WHERE tkp."taskId" = other."taskId"
          AND tkp."columnId" = other."columnId"
          AND tkp.ctid < other.ctid;
      END IF;

      DELETE FROM "RoomKanbanColumn" WHERE id = drop_id;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'RoomKanbanColumn evolve selesai.';
END $$;
