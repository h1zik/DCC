-- CreateEnum
CREATE TYPE "FinanceAuditAction" AS ENUM ('JOURNAL_POST', 'JOURNAL_REVERSE', 'DRAFT_DELETE', 'PERIOD_LOCK', 'PERIOD_UNLOCK', 'FX_RATE_DELETE', 'DEMO_RESET');

-- AlterTable
ALTER TABLE "FinanceJournalEntry" ADD COLUMN     "postedById" TEXT;

-- CreateTable
CREATE TABLE "FinanceAuditEvent" (
    "id" TEXT NOT NULL,
    "action" "FinanceAuditAction" NOT NULL,
    "entityId" VARCHAR(64),
    "detail" VARCHAR(1000),
    "actorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinanceAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FinanceAuditEvent_action_createdAt_idx" ON "FinanceAuditEvent"("action", "createdAt");

-- CreateIndex
CREATE INDEX "FinanceAuditEvent_entityId_idx" ON "FinanceAuditEvent"("entityId");

-- AddForeignKey
ALTER TABLE "FinanceJournalEntry" ADD CONSTRAINT "FinanceJournalEntry_postedById_fkey" FOREIGN KEY ("postedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceAuditEvent" ADD CONSTRAINT "FinanceAuditEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

