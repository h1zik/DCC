import { listFinanceAccounts } from "@/actions/finance-accounts";
import { CoaClient } from "./coa-client";

export default async function ChartOfAccountsPage() {
  const rows = await listFinanceAccounts({ includeInactive: true });

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 pb-10">
      <div className="border-b border-border pb-4">
        <h1 className="text-xl font-semibold tracking-tight">Chart of accounts</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Daftar akun untuk jurnal dan laporan. Default IDR diinisialisasi otomatis saat pertama kali modul dibuka.
        </p>
      </div>
      <CoaClient
        initialRows={rows.map((r) => ({
          id: r.id,
          code: r.code,
          name: r.name,
          type: r.type,
          isActive: r.isActive,
          sortOrder: r.sortOrder,
          tracksCashflow: r.tracksCashflow,
        }))}
      />
    </div>
  );
}
