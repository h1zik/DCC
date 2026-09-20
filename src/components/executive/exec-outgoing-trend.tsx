import { TrendingDown, TrendingUp } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  OUTGOING_CATEGORY_LABELS,
  type OutgoingAggregate,
} from "@/lib/outgoing-metrics";
import { cn } from "@/lib/utils";
import {
  OutgoingCategoryLegend,
  OutgoingCompositionBar,
  formatPcs,
  visibleOutgoingCategories,
} from "./outgoing-category-legend";
import { OutgoingTrendChartLazy } from "./outgoing-trend-chart-lazy";

function chartSummary(data: OutgoingAggregate): string {
  const cats = visibleOutgoingCategories(data.totals);
  const topCat = cats.reduce((a, b) => (data.totals[b] > data.totals[a] ? b : a));
  const peak = data.weekly.reduce((a, b) => (b.totalPcs > a.totalPcs ? b : a));
  const share = Math.round((data.totals[topCat] / data.totalPcs) * 100);
  return (
    `Barang keluar mingguan ${data.windowDays} hari terakhir, total ${formatPcs(data.totalPcs)} PCS. ` +
    `${OUTGOING_CATEGORY_LABELS[topCat]} terbesar (${share}%). ` +
    `Puncak pada minggu ${peak.label} dengan ${formatPcs(peak.totalPcs)} PCS.`
  );
}

export function ExecOutgoingTrend({ data }: { data: OutgoingAggregate }) {
  const categories = visibleOutgoingCategories(data.totals);
  const empty = data.totalPcs === 0;
  const delta = data.deltaPct;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div className="min-w-0">
          <CardTitle>Tren barang keluar</CardTitle>
          <CardDescription>
            PCS stok keluar per minggu, {data.windowDays} hari terakhir — dipecah
            per kategori.
          </CardDescription>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-mono text-2xl font-semibold tracking-tight tabular-nums text-foreground">
            {formatPcs(data.totalPcs)}
            <span className="ml-1 text-xs font-normal text-muted-foreground">
              PCS
            </span>
          </p>
          {delta != null ? (
            <p
              className={cn(
                "mt-0.5 inline-flex items-center gap-1 text-xs font-medium",
                delta >= 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-amber-600 dark:text-amber-400",
              )}
            >
              {delta >= 0 ? (
                <TrendingUp className="size-3.5" aria-hidden />
              ) : (
                <TrendingDown className="size-3.5" aria-hidden />
              )}
              <span className="tabular-nums">
                {delta > 0 ? "+" : ""}
                {delta.toLocaleString("id-ID")}%
              </span>
              <span className="font-normal text-muted-foreground">
                vs {data.windowDays} hari sebelumnya
              </span>
            </p>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {empty ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            Belum ada barang keluar dalam {data.windowDays} hari terakhir.
          </p>
        ) : (
          <>
            <div className="flex flex-col gap-3">
              <OutgoingCompositionBar totals={data.totals} />
              <OutgoingCategoryLegend totals={data.totals} />
            </div>
            <div role="img" aria-label={chartSummary(data)}>
              <OutgoingTrendChartLazy data={data.weekly} categories={categories} />
            </div>
            <table className="sr-only">
              <caption>Barang keluar per minggu per kategori (PCS)</caption>
              <thead>
                <tr>
                  <th scope="col">Minggu mulai</th>
                  {categories.map((c) => (
                    <th key={c} scope="col">
                      {OUTGOING_CATEGORY_LABELS[c]}
                    </th>
                  ))}
                  <th scope="col">Total</th>
                </tr>
              </thead>
              <tbody>
                {data.weekly.map((w) => (
                  <tr key={w.weekStart}>
                    <th scope="row">{w.weekStart}</th>
                    {categories.map((c) => (
                      <td key={c}>{w[c]}</td>
                    ))}
                    <td>{w.totalPcs}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </CardContent>
    </Card>
  );
}
