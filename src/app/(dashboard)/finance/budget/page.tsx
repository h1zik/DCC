import { Target } from "lucide-react";
import { FinanceLedgerType } from "@prisma/client";
import { financeBudgetVsActual } from "@/actions/finance-budget";
import { listFinanceAccounts } from "@/actions/finance-accounts";
import { FinancePageShell } from "@/components/finance/finance-page-shell";
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
    <FinancePageShell
      maxWidth="xl"
      breadcrumbs={[
        { label: "Keuangan", href: "/finance" },
        { label: "Anggaran" },
      ]}
      icon={<Target className="size-5" />}
      title="Anggaran"
      description="Tetapkan plafon (budget) periode untuk akun beban dan bandingkan langsung dengan realisasi dari jurnal."
    >
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
    </FinancePageShell>
  );
}
