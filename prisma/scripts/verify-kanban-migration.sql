-- Pre/post migration verification for Kanban hybrid columns.
-- Run BEFORE backfill to capture baseline, then AFTER backfill to assert safety.

-- Baseline (save output before migration):
-- SELECT COUNT(*) AS total_tasks FROM "Task";
-- SELECT status, COUNT(*) FROM "Task" GROUP BY status ORDER BY status;
-- SELECT COUNT(*) AS kanban_positions FROM "TaskKanbanPosition";

-- 1. Task count unchanged (compare to baseline manually)
SELECT COUNT(*) AS total_tasks FROM "Task";

-- 2. No task without column after backfill
SELECT COUNT(*) AS tasks_without_column FROM "Task" WHERE "kanbanColumnId" IS NULL;

-- 3. No orphan columnId references
SELECT COUNT(*) AS orphan_column_refs
FROM "Task" t
LEFT JOIN "RoomKanbanColumn" c ON c.id = t."kanbanColumnId"
WHERE t."kanbanColumnId" IS NOT NULL AND c.id IS NULL;

-- 4. Status distribution (compare to pre-migration snapshot)
SELECT status, COUNT(*) AS cnt FROM "Task" GROUP BY status ORDER BY status;

-- 5. Every room phase has 4 CORE columns
SELECT r.id AS room_id, c."customProcessPhaseId", c."roomProcess", COUNT(*) FILTER (WHERE c.kind = 'CORE') AS core_count
FROM "Room" r
LEFT JOIN "RoomKanbanColumn" c ON c."roomId" = r.id
GROUP BY r.id, c."customProcessPhaseId", c."roomProcess"
HAVING COUNT(*) FILTER (WHERE c.kind = 'CORE') < 4 AND COUNT(*) > 0;

-- 6. Kanban positions reference valid columns
SELECT COUNT(*) AS orphan_positions
FROM "TaskKanbanPosition" p
LEFT JOIN "RoomKanbanColumn" c ON c.id = p."columnId"
WHERE c.id IS NULL;
