import { Scale } from "lucide-react";
import { listFinanceAccounts } from "@/actions/finance-accounts";
import { FinancePageShell } from "@/components/finance/finance-page-shell";
import { CoaClient } from "./coa-client";

export default async function ChartOfAccountsPage() {
  const rows = await listFinanceAccounts({ includeInactive: true });

  return (
    <FinancePageShell
      maxWidth="lg"
      icon={<Scale className="size-5" />}
      breadcrumbs={[
        { label: "Keuangan", href: "/finance" },
        { label: "Chart of accounts" },
      ]}
      title="Chart of accounts"
      description="Daftar akun untuk jurnal & laporan. Strukturkan kode-akun mengikuti kelompok Aktiva, Kewajiban, Ekuitas, Pendapatan, dan Beban."
    >
      <CoaClient
        initialRows={rows.map((r) => ({
          id: r.id,
          code: r.code,
          name: r.name,
          type: r.type,
          isActive: r.isActive,
          sortOrder: r.sortOrder,
          tracksCashflow: r.tracksCashflow,
          isApControl: r.isApControl,
          isArControl: r.isArControl,
        }))}
      />
    </FinancePageShell>
  );
}
