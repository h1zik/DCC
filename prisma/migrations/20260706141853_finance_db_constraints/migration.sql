-- DropForeignKey
ALTER TABLE "FinanceApPayment" DROP CONSTRAINT "FinanceApPayment_billId_fkey";

-- DropForeignKey
ALTER TABLE "FinanceArPayment" DROP CONSTRAINT "FinanceArPayment_invoiceId_fkey";

-- AddForeignKey
ALTER TABLE "FinanceApPayment" ADD CONSTRAINT "FinanceApPayment_billId_fkey" FOREIGN KEY ("billId") REFERENCES "FinanceApBill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceArPayment" ADD CONSTRAINT "FinanceArPayment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "FinanceArInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- CHECK constraints (M-02): penegakan level-DB yang tidak bisa dimodelkan
-- Prisma. Catatan Postgres: NaN dianggap >= 0 pada perbandingan numeric,
-- sehingga NaN harus ditolak eksplisit ("x <> 'NaN'" bernilai false untuk NaN
-- karena NaN = NaN di Postgres).

-- Baris jurnal: nominal non-negatif, bukan NaN, dan satu baris satu sisi.
ALTER TABLE "FinanceJournalLine"
  ADD CONSTRAINT "FinanceJournalLine_amounts_valid_check"
  CHECK (
    "debitBase" >= 0 AND "creditBase" >= 0
    AND "debitBase" <> 'NaN'::numeric AND "creditBase" <> 'NaN'::numeric
    AND NOT ("debitBase" > 0 AND "creditBase" > 0)
  );

-- Dokumen & pembayaran AP/AR: nominal positif dan bukan NaN.
ALTER TABLE "FinanceApBill"
  ADD CONSTRAINT "FinanceApBill_amount_positive_check"
  CHECK ("amount" > 0 AND "amount" <> 'NaN'::numeric);

ALTER TABLE "FinanceArInvoice"
  ADD CONSTRAINT "FinanceArInvoice_amount_positive_check"
  CHECK ("amount" > 0 AND "amount" <> 'NaN'::numeric);

ALTER TABLE "FinanceApPayment"
  ADD CONSTRAINT "FinanceApPayment_amount_positive_check"
  CHECK ("amount" > 0 AND "amount" <> 'NaN'::numeric);

ALTER TABLE "FinanceArPayment"
  ADD CONSTRAINT "FinanceArPayment_amount_positive_check"
  CHECK ("amount" > 0 AND "amount" <> 'NaN'::numeric);

-- Pengajuan dana: positif; budget: non-negatif.
ALTER TABLE "FinanceSpendRequest"
  ADD CONSTRAINT "FinanceSpendRequest_amount_positive_check"
  CHECK ("amount" > 0 AND "amount" <> 'NaN'::numeric);

ALTER TABLE "FinanceBudgetLine"
  ADD CONSTRAINT "FinanceBudgetLine_amountLimit_nonnegative_check"
  CHECK ("amountLimit" >= 0 AND "amountLimit" <> 'NaN'::numeric);
