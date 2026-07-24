"use client";

import { ArrowRight, Boxes, CheckCircle2 } from "lucide-react";
import type { InventoryDashboardStats } from "@/lib/inventory-metrics";
import { ReorderStatusBadge } from "@/components/logistics/reorder-status-badge";
import { StockHealthBadge } from "@/components/logistics/stock-health-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Teaser top-5 SKU yang perlu perhatian di tab Ringkasan. Rumah lengkap
 * forecast/reorder ada di tab "Stok & Reorder" — panel ini hanya menunjuk.
 */
export function ReorderTeaser({
  items,
  onSeeAll,
}: {
  items: InventoryDashboardStats["reorderList"];
  onSeeAll: () => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Boxes className="size-4" aria-hidden />
          Perlu perhatian{items.length > 0 ? ` (${items.length})` : ""}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.length === 0 ? (
          <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/5 px-3 py-2.5 text-sm">
            <CheckCircle2 className="text-success size-4 shrink-0" aria-hidden />
            <span>Semua SKU dalam batas aman. Tidak ada reorder mendesak.</span>
          </div>
        ) : (
          <>
            {items.slice(0, 5).map((item) => (
              <div
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{item.name}</p>
                  <p className="text-muted-foreground text-xs">
                    {item.brandName} · <span className="font-mono">{item.sku}</span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs tabular-nums">
                    {item.currentStock}/{item.minStock} min
                  </span>
                  {item.reorderStatus === "ORDER_NOW" ||
                  item.reorderStatus === "ORDER_SOON" ? (
                    <ReorderStatusBadge status={item.reorderStatus} />
                  ) : (
                    <StockHealthBadge
                      currentStock={item.currentStock}
                      minStock={item.minStock}
                    />
                  )}
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={onSeeAll}
              className="text-accent-foreground inline-flex items-center gap-1 text-xs font-medium hover:underline"
            >
              Lihat semua ({items.length})
              <ArrowRight className="size-3" aria-hidden />
            </button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
