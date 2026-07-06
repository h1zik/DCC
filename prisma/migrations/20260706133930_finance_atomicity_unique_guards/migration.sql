-- DropIndex
DROP INDEX "FinanceJournalEntry_reversesEntryId_idx";

-- CreateIndex
CREATE UNIQUE INDEX "FinanceJournalEntry_reversesEntryId_key" ON "FinanceJournalEntry"("reversesEntryId");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceSpendRequest_payoutEntryId_key" ON "FinanceSpendRequest"("payoutEntryId");

