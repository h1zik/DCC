-- Migrasi aman TaskKanbanPosition: (taskId, status) → (taskId, columnId)
-- Jalankan SEBELUM `prisma db push` pada database production yang sudah punya data.
-- Idempotent: aman dijalankan ulang (no-op jika kolom `status` sudah tidak ada).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'TaskKanbanPosition'
      AND column_name = 'status'
  ) THEN
    RAISE NOTICE 'TaskKanbanPosition sudah memakai columnId — lewati evolve.';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'TaskKanbanPosition'
      AND column_name = 'columnId'
  ) THEN
    ALTER TABLE "TaskKanbanPosition" ADD COLUMN "columnId" TEXT;
  END IF;

  UPDATE "TaskKanbanPosition" tkp
  SET "columnId" = (
    SELECT c.id
    FROM "Task" t
    INNER JOIN "Project" p ON p.id = t."projectId"
    INNER JOIN "RoomKanbanColumn" c ON c."roomId" = p."roomId"
    WHERE t.id = tkp."taskId"
      AND c."linkedStatus" = tkp.status
      AND (
        (
          t."customProcessPhaseId" IS NOT NULL
          AND c."customProcessPhaseId" = t."customProcessPhaseId"
        )
        OR (
          t."customProcessPhaseId" IS NULL
          AND c."customProcessPhaseId" IS NULL
          AND c."roomProcess" = t."roomProcess"
        )
      )
    ORDER BY c."sortOrder" ASC
    LIMIT 1
  )
  WHERE tkp."columnId" IS NULL;

  -- Hapus baris yang tidak bisa dipetakan (hanya urutan kartu; Task tidak tersentuh).
  DELETE FROM "TaskKanbanPosition" WHERE "columnId" IS NULL;

  -- Satu baris per (taskId, columnId); simpan sortKey terkecil.
  DELETE FROM "TaskKanbanPosition" tkp
  WHERE tkp.ctid NOT IN (
    SELECT DISTINCT ON ("taskId", "columnId") ctid
    FROM "TaskKanbanPosition"
    WHERE "columnId" IS NOT NULL
    ORDER BY "taskId", "columnId", "sortKey" ASC
  );

  ALTER TABLE "TaskKanbanPosition" DROP CONSTRAINT IF EXISTS "TaskKanbanPosition_pkey";
  ALTER TABLE "TaskKanbanPosition" DROP COLUMN IF EXISTS "status";
  ALTER TABLE "TaskKanbanPosition" ALTER COLUMN "columnId" SET NOT NULL;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'TaskKanbanPosition_pkey'
  ) THEN
    ALTER TABLE "TaskKanbanPosition"
      ADD CONSTRAINT "TaskKanbanPosition_pkey" PRIMARY KEY ("taskId", "columnId");
  END IF;

  RAISE NOTICE 'TaskKanbanPosition evolve selesai.';
END $$;
