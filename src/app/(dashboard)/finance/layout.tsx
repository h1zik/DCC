import { ensureFinanceCoaReady } from "@/actions/finance-accounts";
import { ensureFinancePage } from "@/lib/ensure-finance-page";

export default async function FinanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await ensureFinancePage();
  await ensureFinanceCoaReady();
  return children;
}
