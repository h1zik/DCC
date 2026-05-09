import { Tag } from "lucide-react";
import { reportProfitLossByBrand } from "@/actions/finance-reports";
import { FinanceEmptyState } from "@/components/finance/empty-state";
import { FinancePageShell } from "@/components/finance/finance-page-shell";
import { Money } from "@/components/finance/money";
import { FinanceSectionCard } from "@/components/finance/section-card";
import { CogsCalculator } from "./cogs-calculator";

export default async function BrandsCostingPage() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  const rows = await reportProfitLossByBrand({
    from,
    to,
    brandId: null,
    onlyUntagged: undefined,
  });

  return (
    <FinancePageShell
      maxWidth="lg"
      breadcrumbs={[
        { label: "Keuangan", href: "/finance" },
        { label: "Brand & costing" },
      ]}
      icon={<Tag className="size-5" />}
      title="Brand & costing"
      description="Ringkasan laba rugi per brand untuk bulan berjalan (dari jurnal terposting yang sudah ditag brand) dan kalkulator HPP/margin sederhana."
    >
      <FinanceSectionCard
        title="Laba rugi per brand"
        accent="emerald"
        description="Periode bulan berjalan. Brand tanpa tag dikelompokkan sebagai 'Tanpa brand'."
      >
        {rows.length === 0 ? (
          <FinanceEmptyState
            title="Belum ada aktivitas brand"
            description="Tag jurnal Anda ke brand untuk melihat profitabilitas per segmen di sini."
          />
        ) : (
          <div className="border-border/60 overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-border/60 border-b text-left text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-3 py-2 font-semibold">Brand / segmen</th>
                  <th className="px-3 py-2 text-right font-semibold">
                    Laba bersih (approx.)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-border/60 divide-y">
                {rows.map((r) => {
                  const v = Number(r.netIncome.toString());
                  return (
                    <tr key={r.brandId ?? "u"} className="hover:bg-muted/30">
                      <td className="px-3 py-2">{r.brandName}</td>
                      <td className="px-3 py-2 text-right">
                        <Money
                          value={r.netIncome.toString()}
                          tone={v >= 0 ? "positive" : "negative"}
                          className="text-sm font-semibold"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </FinanceSectionCard>

      <FinanceSectionCard
        title="Kalkulator HPP / margin"
        accent="violet"
        description="Hitung cepat HPP, margin kotor, dan harga jual yang disarankan."
      >
        <CogsCalculator />
      </FinanceSectionCard>
    </FinancePageShell>
  );
}
