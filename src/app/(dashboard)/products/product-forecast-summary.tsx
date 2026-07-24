"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { ReorderStatusBadge } from "@/components/logistics/reorder-status-badge";
import type { ProductReorderForecast } from "@/lib/reorder-forecast";

/**
 * Ringkasan forecast di dalam editor produk — sengaja ringkas; detail lengkap
 * satu rumah di /inventory tab "Stok & Reorder".
 */
export function ProductForecastSummary({
  forecast,
}: {
  forecast: ProductReorderForecast;
}) {
  return (
    <div className="space-y-2.5 rounded-lg border bg-muted/30 px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
          Forecast reorder ({forecast.windowDays} hari)
        </p>
        <ReorderStatusBadge status={forecast.status} />
      </div>
      <dl className="grid grid-cols-3 gap-2 text-center">
        <div>
          <dt className="text-muted-foreground text-[10px]">Burn rate</dt>
          <dd className="text-sm font-medium tabular-nums">
            {forecast.avgDailyDemand.toFixed(2)}
            <span className="text-muted-foreground text-[10px]"> /hari</span>
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-[10px]">Habis ~</dt>
          <dd className="text-sm font-medium tabular-nums">
            {forecast.daysUntilStockout != null
              ? `${forecast.daysUntilStockout.toFixed(0)} hari`
              : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-[10px]">Order sebelum</dt>
          <dd className="text-sm font-medium">
            {forecast.orderByDate
              ? format(forecast.orderByDate, "d MMM", { locale: idLocale })
              : "—"}
          </dd>
        </div>
      </dl>
      <Link
        href="/inventory?tab=stok"
        className="text-accent-foreground inline-flex items-center gap-1 text-xs font-medium hover:underline"
      >
        Forecast lengkap
        <ArrowRight className="size-3" aria-hidden />
      </Link>
    </div>
  );
}
