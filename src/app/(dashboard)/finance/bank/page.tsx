import { FinanceLedgerType } from "@prisma/client";
import { listFinanceAccounts } from "@/actions/finance-accounts";
import { listFinanceBankAccounts } from "@/actions/finance-bank";
import { BankClient } from "./bank-client";

export default async function BankPage() {
  const [banks, accounts] = await Promise.all([
    listFinanceBankAccounts(),
    listFinanceAccounts(),
  ]);

  const assetAccounts = accounts.filter((a) => a.type === FinanceLedgerType.ASSET);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 pb-10">
      <div className="border-b border-border pb-4">
        <h1 className="text-xl font-semibold tracking-tight">Rekonsiliasi bank</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Daftar rekening operasional dan impor mutasi untuk dicocokkan dengan jurnal.
        </p>
      </div>
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
    </div>
  );
}
