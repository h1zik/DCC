import { listFinanceAccounts } from "@/actions/finance-accounts";
import { listFinanceFixedAssets } from "@/actions/finance-assets";
import { FixedAssetsClient } from "./fixed-assets-client";

export default async function FixedAssetsPage() {
  const [assets, accounts] = await Promise.all([
    listFinanceFixedAssets(),
    listFinanceAccounts(),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 pb-10">
      <div className="border-b border-border pb-4">
        <h1 className="text-xl font-semibold tracking-tight">Aset tetap</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Registrasi aset dan posting penyusutan garis lurus bulanan.
        </p>
      </div>
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
    </div>
  );
}
