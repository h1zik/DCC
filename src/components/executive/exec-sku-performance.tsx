import { PackageCheck, PackageX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  OUTGOING_CATEGORY_COLOR_VAR,
  type OutgoingAggregate,
} from "@/lib/outgoing-metrics";
import { formatPcs } from "./outgoing-category-legend";

function EmptyRow({ text }: { text: string }) {
  return <p className="py-10 text-center text-sm text-muted-foreground">{text}</p>;
}

export function ExecSkuPerformance({ data }: { data: OutgoingAggregate }) {
  const maxSales = data.topSellers[0]?.byCategory.penjualan ?? 0;

  return (
    <section className="grid gap-4 md:grid-cols-2" aria-label="Performa SKU">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PackageCheck className="size-4 text-muted-foreground" />
            SKU terlaris
          </CardTitle>
          <CardDescription>
            Berdasarkan PCS penjualan, {data.windowDays} hari terakhir.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.topSellers.length === 0 ? (
            <EmptyRow text="Belum ada penjualan pada rentang ini." />
          ) : (
            <ol className="flex flex-col gap-3">
              {data.topSellers.map((s, i) => (
                <li key={s.productId} className="flex items-center gap-3">
                  <span className="w-4 shrink-0 text-center font-mono text-xs tabular-nums text-muted-foreground">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="min-w-0 truncate text-sm font-medium text-foreground">
                        {s.name}
                      </p>
                      <p className="shrink-0 font-mono text-sm tabular-nums text-foreground">
                        {formatPcs(s.byCategory.penjualan)}
                      </p>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {s.brandName} · {s.sku}
                    </p>
                    <div className="mt-1.5 h-1 w-full rounded-full bg-muted/40">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${maxSales > 0 ? (s.byCategory.penjualan / maxSales) * 100 : 0}%`,
                          background: OUTGOING_CATEGORY_COLOR_VAR.penjualan,
                        }}
                      />
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PackageX className="size-4 text-muted-foreground" />
            Retur &amp; rusak tertinggi
          </CardTitle>
          <CardDescription>
            Persentase = (retur + rusak) dari seluruh barang keluar SKU itu.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.topLoss.length === 0 ? (
            <EmptyRow text="Tidak ada retur atau barang rusak pada rentang ini." />
          ) : (
            <>
              <ul className="flex flex-col gap-3">
                {data.topLoss.map((s) => (
                  <li
                    key={s.productId}
                    className="flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {s.name}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {s.brandName} · {s.sku}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <p className="text-right text-xs tabular-nums text-muted-foreground">
                        Retur{" "}
                        <span className="font-mono text-foreground">
                          {formatPcs(s.byCategory.retur)}
                        </span>
                        <br />
                        Rusak{" "}
                        <span className="font-mono text-foreground">
                          {formatPcs(s.byCategory.rusak)}
                        </span>
                      </p>
                      <Badge
                        variant={
                          s.lossRatePct >= 10
                            ? "destructive"
                            : s.lossRatePct >= 5
                              ? "secondary"
                              : "outline"
                        }
                        className="min-w-14 justify-center font-mono tabular-nums"
                      >
                        {s.lossRatePct.toLocaleString("id-ID")}%
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
              <p className="mt-4 border-t border-border/70 pt-3 text-xs leading-relaxed text-muted-foreground">
                Penyesuaian stok turun (stock opname) otomatis tercatat sebagai
                Rusak, jadi angka ini bisa memuat selisih opname.
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
