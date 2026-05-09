import { ensureFinanceCoaReady } from "@/actions/finance-accounts";
import { ensureFinancePage } from "@/lib/ensure-finance-page";
import { FinanceSubNav } from "@/components/finance/finance-sub-nav";

export default async function FinanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await ensureFinancePage();
  await ensureFinanceCoaReady();
  return (
    <div className="flex w-full flex-col">
      <FinanceSubNav />
      <div className="px-2 sm:px-4">{children}</div>
    </div>
  );
}
