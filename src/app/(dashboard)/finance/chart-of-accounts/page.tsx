import { Scale } from "lucide-react";
import { listFinanceAccounts } from "@/actions/finance-accounts";
import { listFinanceBankAccounts } from "@/actions/finance-bank";
import { FinancePageShell } from "@/components/finance/finance-page-shell";
import { CoaClient } from "./coa-client";

export default async function ChartOfAccountsPage() {
  const [rows, banks] = await Promise.all([
    listFinanceAccounts({ includeInactive: true }),
    listFinanceBankAccounts(),
  ]);
  const ledgerIdsWithBank = new Set(banks.map((b) => b.ledgerAccountId));

  return (
    <FinancePageShell
      icon={<Scale className="size-5" />}
      breadcrumbs={[
        { label: "Keuangan", href: "/finance" },
        { label: "Chart of accounts" },
      ]}
      title="Chart of accounts"
      description="Daftar akun untuk jurnal & laporan. Strukturkan kode-akun mengikuti kelompok Aktiva, Kewajiban, Ekuitas, Pendapatan, dan Beban. Akun Aktiva bertanda arus kas otomatis jadi rekening untuk pembayaran & transfer."
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
          hasBankAccount: ledgerIdsWithBank.has(r.id),
        }))}
      />
    </FinancePageShell>
  );
}
