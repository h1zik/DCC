import { Building2 } from "lucide-react";
import { listFinanceAccounts } from "@/actions/finance-accounts";
import { listFinanceFixedAssets } from "@/actions/finance-assets";
import { FinancePageShell } from "@/components/finance/finance-page-shell";
import { FixedAssetsClient } from "./fixed-assets-client";

export default async function FixedAssetsPage() {
  const [assets, accounts] = await Promise.all([
    listFinanceFixedAssets(),
    listFinanceAccounts(),
  ]);

  return (
    <FinancePageShell
      maxWidth="xl"
      breadcrumbs={[
        { label: "Keuangan", href: "/finance" },
        { label: "Aset tetap" },
      ]}
      icon={<Building2 className="size-5" />}
      title="Aset tetap"
      description="Registrasi aset, lacak nilai buku, dan posting penyusutan garis lurus secara bulanan."
    >
      <FixedAssetsClient
        assets={assets.map((a) => ({
          id: a.id,
          name: a.name,
          category: a.category,
          cost: a.cost.toString(),
          accumulatedDepreciation: a.accumulatedDepreciation.toString(),
          usefulLifeMonths: a.usefulLifeMonths,
        }))}
        accounts={accounts.map((a) => ({
          id: a.id,
          code: a.code,
          name: a.name,
        }))}
      />
    </FinancePageShell>
  );
}
