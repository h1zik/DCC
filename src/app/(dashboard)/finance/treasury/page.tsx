import { Coins } from "lucide-react";
import { listFinanceBankAccounts } from "@/actions/finance-bank";
import { financeCashflowLines } from "@/actions/finance-treasury";
import { jakartaCurrentMonthRange } from "@/lib/finance-dates";
import { FinancePageShell } from "@/components/finance/finance-page-shell";
import { TreasuryClient } from "./treasury-client";

export default async function TreasuryPage() {
  const { from, to } = jakartaCurrentMonthRange();

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
    <FinancePageShell
      breadcrumbs={[
        { label: "Keuangan", href: "/finance" },
        { label: "Kas & treasury" },
      ]}
      icon={<Coins className="size-5" />}
      title="Kas & treasury"
      description="Transfer antar rekening bank dan pantau mutasi akun arus kas pada bulan berjalan."
    >
      <TreasuryClient
        banks={banks.map((b) => ({ id: b.id, name: b.name }))}
        cashflow={cashflow}
      />
    </FinancePageShell>
  );
}
