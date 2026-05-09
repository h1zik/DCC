import { Globe2 } from "lucide-react";
import { listFinanceFxRates } from "@/actions/finance-fx";
import { FinancePageShell } from "@/components/finance/finance-page-shell";
import { CurrencyClient } from "./currency-client";

export default async function CurrenciesPage() {
  const rates = await listFinanceFxRates();

  return (
    <FinancePageShell
      maxWidth="md"
      breadcrumbs={[
        { label: "Keuangan", href: "/finance" },
        { label: "Multi-mata uang" },
      ]}
      icon={<Globe2 className="size-5" />}
      title="Multi-mata uang"
      description="Kurs terhadap IDR (1 unit valas = berapa Rupiah). Dipakai otomatis ketika baris jurnal menggunakan mata uang non-IDR."
    >
      <CurrencyClient
        initialRates={rates.map((r) => ({
          id: r.id,
          currencyCode: r.currencyCode,
          rateToBase: r.rateToBase.toString(),
          validFrom: r.validFrom.toISOString(),
        }))}
      />
    </FinancePageShell>
  );
}
