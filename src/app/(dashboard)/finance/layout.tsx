import { ensureFinanceCoaReady } from "@/actions/finance-accounts";
import { ensureFinancePage } from "@/lib/ensure-finance-page";

// Navigasi antar-modul keuangan ada di sidebar (navFinance) — tidak perlu
// sub-nav kedua di atas konten.
export default async function FinanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await ensureFinancePage();
  await ensureFinanceCoaReady();
  return <div className="flex w-full min-w-0 flex-col gap-4">{children}</div>;
}
