import { FinanceLedgerType } from "@prisma/client";
import { listFinanceSpendRequests } from "@/actions/finance-spend";
import { listFinanceAccounts } from "@/actions/finance-accounts";
import { listFinanceBankAccounts } from "@/actions/finance-bank";
import { prisma } from "@/lib/prisma";
import { ApprovalsClient } from "./approvals-client";

export default async function FinanceApprovalsPage() {
  const [requests, expenseAccounts, banks, brands] = await Promise.all([
    listFinanceSpendRequests(),
    listFinanceAccounts(),
    listFinanceBankAccounts(),
    prisma.brand.findMany({ orderBy: { name: "asc" } }),
  ]);

  const expenses = expenseAccounts.filter((a) => a.type === FinanceLedgerType.EXPENSE);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 pb-10">
      <div className="border-b border-border pb-4">
        <h1 className="text-xl font-semibold tracking-tight">Persetujuan pengeluaran</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Ajukan → kirim → persetujuan Finance → pembayaran (jurnal otomatis).
        </p>
      </div>
      <ApprovalsClient
        requests={requests.map((r) => ({
          id: r.id,
          title: r.title,
          amount: r.amount.toString(),
          status: r.status,
          requestedBy: {
            name: r.requestedBy.name,
            email: r.requestedBy.email,
          },
        }))}
        expenseAccounts={expenses.map((a) => ({
          id: a.id,
          code: a.code,
          name: a.name,
        }))}
        banks={banks.map((b) => ({ id: b.id, name: b.name }))}
        brands={brands.map((b) => ({ id: b.id, name: b.name }))}
      />
    </div>
  );
}
