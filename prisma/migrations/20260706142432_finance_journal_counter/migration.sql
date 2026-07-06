-- CreateTable
CREATE TABLE "FinanceJournalCounter" (
    "year" INTEGER NOT NULL,
    "lastSeq" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "FinanceJournalCounter_pkey" PRIMARY KEY ("year")
);

