import {
  reportBalanceSheet,
  reportCashFlow,
  reportProfitLoss,
  reportTaxBuckets,
} from "@/actions/finance-reports";
import { formatIdr } from "@/lib/finance-money";
import { Prisma } from "@prisma/client";

export default async function FinanceReportsPage() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  const [pl, bs, cf, tax] = await Promise.all([
    reportProfitLoss({ from, to, brandId: null }),
    reportBalanceSheet(to, null),
    reportCashFlow({ from, to, brandId: null }),
    reportTaxBuckets({ from, to, brandId: null }),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 pb-10">
      <div className="border-b border-border pb-4">
        <h1 className="text-xl font-semibold tracking-tight">Pelaporan keuangan</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Ringkasan bulan berjalan dari jurnal terposting (IDR).
        </p>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">Laba rugi</h2>
        <ReportTable
          rows={pl.rows.map((r) => ({
            label: `${r.code} ${r.name}`,
            value: r.amount,
            type: r.type,
          }))}
        />
        <p className="text-muted-foreground text-xs">
          Pendapatan bersih segmen: {fmt(pl.revenue)} · Beban: {fmt(pl.expense)} · Laba:{" "}
          <span className="text-foreground font-semibold">{fmt(pl.netIncome)}</span>
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">Neraca (posisi akhir periode)</h2>
        <ReportTable
          rows={[
            ...bs.assets.map((r) => ({
              label: `${r.code} ${r.name}`,
              value: r.amount,
              type: "ASSET" as const,
            })),
            ...bs.liabilities.map((r) => ({
              label: `${r.code} ${r.name}`,
              value: r.amount,
              type: "LIABILITY" as const,
            })),
            ...bs.equity.map((r) => ({
              label: `${r.code} ${r.name}`,
              value: r.amount,
              type: "EQUITY" as const,
            })),
            {
              label: "Laba ditahan (dari L/R kumulatif)",
              value: bs.retainedEarnings,
              type: "EQUITY" as const,
            },
          ]}
        />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">Arus kas (akun bertanda arus kas)</h2>
        <p className="text-muted-foreground text-xs">
          Perkiraan neto mutasi kas (aktiva debit − kredit pada akun arus kas):{" "}
          {fmt(cf.netOperatingCashApprox)}
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">Rekapitulasi pajak (akun 2100 / 2200)</h2>
        <ul className="text-muted-foreground text-sm">
          {tax.rows.map((t) => (
            <li key={t.code}>
              {t.label}: {fmt(t.amount)}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function fmt(d: Prisma.Decimal) {
  return formatIdr(d);
}

function ReportTable({
  rows,
}: {
  rows: { label: string; value: Prisma.Decimal; type: string }[];
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 border-b text-left text-xs">
          <tr>
            <th className="p-2">Akun</th>
            <th className="p-2 text-right">Nilai</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b">
              <td className="p-2 text-xs">{r.label}</td>
              <td className="p-2 text-right font-mono text-xs tabular-nums">{fmt(r.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
