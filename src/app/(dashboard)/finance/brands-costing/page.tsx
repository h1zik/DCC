import { reportProfitLossByBrand } from "@/actions/finance-reports";
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
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-10 pb-10">
      <div className="border-b border-border pb-4">
        <h1 className="text-xl font-semibold tracking-tight">Brand & costing</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Ringkasan laba rugi per brand untuk bulan berjalan (dari jurnal terposting dengan tag brand).
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">Laba rugi per brand (bulan ini)</h2>
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b text-left text-xs">
              <tr>
                <th className="p-3">Brand / segmen</th>
                <th className="p-3 text-right">Laba rugi bersih (approx)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.brandId ?? "u"} className="border-b">
                  <td className="p-3">{r.brandName}</td>
                  <td className="p-3 text-right font-mono tabular-nums">
                    {Number(r.netIncome.toString()).toLocaleString("id-ID", {
                      style: "currency",
                      currency: "IDR",
                      maximumFractionDigits: 0,
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">Kalkulator HPP / margin</h2>
        <CogsCalculator />
      </section>
    </div>
  );
}
