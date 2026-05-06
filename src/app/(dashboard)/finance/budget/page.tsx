import { FinanceLedgerType } from "@prisma/client";
import { financeBudgetVsActual } from "@/actions/finance-budget";
import { listFinanceAccounts } from "@/actions/finance-accounts";
import { prisma } from "@/lib/prisma";
import { BudgetClient } from "./budget-client";

export default async function BudgetPage() {
  const year = new Date().getFullYear();
  const month = new Date().getMonth() + 1;

  const [accounts, brands, vs] = await Promise.all([
    listFinanceAccounts(),
    prisma.brand.findMany({ orderBy: { name: "asc" } }),
    financeBudgetVsActual({ year, month }),
  ]);

  const expenseAccounts = accounts.filter((a) => a.type === FinanceLedgerType.EXPENSE);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 pb-10">
      <div className="border-b border-border pb-4">
        <h1 className="text-xl font-semibold tracking-tight">Anggaran</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Tetapkan plafon periode dan bandingkan dengan beban aktual dari jurnal.
        </p>
      </div>
      <BudgetClient
        year={year}
        accounts={expenseAccounts.map((a) => ({
          id: a.id,
          code: a.code,
          name: a.name,
        }))}
        brands={brands.map((b) => ({ id: b.id, name: b.name }))}
        initialVs={vs.map((r) => ({
          budgetId: r.budgetId,
          label: r.label,
          limit: r.limit.toString(),
          actual: r.actual.toString(),
          variance: r.variance.toString(),
        }))}
      />
    </div>
  );
}
