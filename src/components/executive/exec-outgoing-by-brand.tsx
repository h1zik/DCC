import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  OUTGOING_CATEGORIES,
  OUTGOING_CATEGORY_COLOR_VAR,
  OUTGOING_CATEGORY_LABELS,
  emptyCategoryPcs,
  type OutgoingAggregate,
  type OutgoingBrandRow,
} from "@/lib/outgoing-metrics";
import { formatPcs } from "./outgoing-category-legend";

const MAX_BRANDS = 8;

/** Top 8 brand; sisanya digabung "Lainnya" supaya kartu tidak memanjang. */
function foldBrands(brands: OutgoingBrandRow[]): OutgoingBrandRow[] {
  if (brands.length <= MAX_BRANDS) return brands;
  const head = brands.slice(0, MAX_BRANDS - 1);
  const rest = brands.slice(MAX_BRANDS - 1);
  const byCategory = emptyCategoryPcs();
  for (const b of rest) {
    for (const c of OUTGOING_CATEGORIES) byCategory[c] += b.byCategory[c];
  }
  return [
    ...head,
    {
      brandName: `Lainnya (${rest.length} brand)`,
      totalPcs: rest.reduce((acc, b) => acc + b.totalPcs, 0),
      byCategory,
      samplingToSalesPct:
        byCategory.penjualan > 0
          ? Math.round((byCategory.sampling / byCategory.penjualan) * 1000) / 10
          : null,
    },
  ];
}

export function ExecOutgoingByBrand({ data }: { data: OutgoingAggregate }) {
  const rows = foldBrands(data.brands);
  const maxTotal = rows.reduce((m, b) => Math.max(m, b.totalPcs), 0);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div>
          <CardTitle>Per brand</CardTitle>
          <CardDescription>
            Panjang bar = total PCS; segmen = kategori.
          </CardDescription>
        </div>
        <Link
          href="/inventory"
          className="shrink-0 text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Mutasi stok
        </Link>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            Belum ada transaksi barang keluar.
          </p>
        ) : (
          <ul className="flex flex-col gap-3.5">
            {rows.map((b) => {
              const parts = OUTGOING_CATEGORIES.filter((c) => b.byCategory[c] > 0);
              const detail = parts
                .map(
                  (c) =>
                    `${OUTGOING_CATEGORY_LABELS[c]} ${formatPcs(b.byCategory[c])}`,
                )
                .join(" · ");
              const widthPct =
                maxTotal > 0 ? Math.max(4, (b.totalPcs / maxTotal) * 100) : 0;
              return (
                <li key={b.brandName} className="flex flex-col gap-1.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 truncate text-sm font-medium text-foreground">
                      {b.brandName}
                    </span>
                    <span className="shrink-0 font-mono text-sm tabular-nums text-foreground">
                      {formatPcs(b.totalPcs)}
                      <span className="ml-1 text-xs text-muted-foreground">PCS</span>
                    </span>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-muted/40">
                    <div
                      role="img"
                      aria-label={`${b.brandName}: ${detail}`}
                      className="flex h-full gap-0.5 overflow-hidden rounded-full"
                      style={{ width: `${widthPct}%` }}
                    >
                      {parts.map((c) => (
                        <span
                          key={c}
                          className="h-full min-w-0.5"
                          style={{
                            flexGrow: b.byCategory[c],
                            flexBasis: 0,
                            background: OUTGOING_CATEGORY_COLOR_VAR[c],
                          }}
                        />
                      ))}
                    </div>
                  </div>
                  <p className="flex flex-wrap items-center justify-between gap-x-3 text-xs text-muted-foreground">
                    <span className="tabular-nums">{detail}</span>
                    {b.samplingToSalesPct != null && b.byCategory.sampling > 0 ? (
                      <span className="tabular-nums">
                        Rasio sampling{" "}
                        <span className="font-medium text-foreground/80">
                          {b.samplingToSalesPct.toLocaleString("id-ID")}%
                        </span>
                      </span>
                    ) : null}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
