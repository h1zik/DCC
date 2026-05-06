import { listFinanceBankAccounts } from "@/actions/finance-bank";
import { financeCashflowLines } from "@/actions/finance-treasury";
import { TreasuryClient } from "./treasury-client";

export default async function TreasuryPage() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  const [banks, cf] = await Promise.all([
    listFinanceBankAccounts(),
    financeCashflowLines({ from, to }),
  ]);

  const cashflow = cf.map((r) => ({
    id: r.id,
    debitBase: r.debitBase.toString(),
    creditBase: r.creditBase.toString(),
    memo: r.memo,
    account: { code: r.account.code, name: r.account.name },
    entry: {
      entryDate: r.entry.entryDate.toISOString(),
      reference: r.entry.reference,
    },
  }));

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 pb-10">
      <div className="border-b border-border pb-4">
        <h1 className="text-xl font-semibold tracking-tight">Kas & treasury</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Transfer antar rekening bank dan pantau mutasi akun arus kas bulan berjalan.
        </p>
      </div>
      <TreasuryClient
        banks={banks.map((b) => ({ id: b.id, name: b.name }))}
        cashflow={cashflow}
      />
    </div>
  );
}
