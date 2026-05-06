import { listFinanceFxRates } from "@/actions/finance-fx";
import { CurrencyClient } from "./currency-client";

export default async function CurrenciesPage() {
  const rates = await listFinanceFxRates();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 pb-10">
      <div className="border-b border-border pb-4">
        <h1 className="text-xl font-semibold tracking-tight">Multi-mata uang</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Kurs terhadap IDR (1 unit valas = berapa Rupiah). Dipakai saat baris jurnal non-IDR.
        </p>
      </div>
      <CurrencyClient
        initialRates={rates.map((r) => ({
          id: r.id,
          currencyCode: r.currencyCode,
          rateToBase: r.rateToBase.toString(),
          validFrom: r.validFrom.toISOString(),
        }))}
      />
    </div>
  );
}
