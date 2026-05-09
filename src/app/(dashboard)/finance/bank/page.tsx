import { Banknote } from "lucide-react";
import { FinanceLedgerType } from "@prisma/client";
import { listFinanceAccounts } from "@/actions/finance-accounts";
import { listFinanceBankAccounts } from "@/actions/finance-bank";
import { FinancePageShell } from "@/components/finance/finance-page-shell";
import { BankClient } from "./bank-client";

export default async function BankPage() {
  const [banks, accounts] = await Promise.all([
    listFinanceBankAccounts(),
    listFinanceAccounts(),
  ]);

  const assetAccounts = accounts.filter((a) => a.type === FinanceLedgerType.ASSET);

  return (
    <FinancePageShell
      maxWidth="lg"
      breadcrumbs={[
        { label: "Keuangan", href: "/finance" },
        { label: "Rekonsiliasi bank" },
      ]}
      icon={<Banknote className="size-5" />}
      title="Rekonsiliasi bank"
      description="Daftar rekening operasional dan impor mutasi untuk dicocokkan dengan jurnal — pastikan saldo bank sesuai dengan saldo buku."
    >
      <BankClient
        banks={banks.map((b) => ({
          id: b.id,
          name: b.name,
          institution: b.institution,
          ledgerAccount: {
            code: b.ledgerAccount.code,
            name: b.ledgerAccount.name,
          },
        }))}
        assetAccounts={assetAccounts.map((a) => ({
          id: a.id,
          code: a.code,
          name: a.name,
        }))}
      />
    </FinancePageShell>
  );
}
