"use client";

import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Boxes,
  Package,
} from "lucide-react";
import type { InventoryDashboardStats } from "@/lib/inventory-metrics";
import { reorderStatusLabel } from "@/lib/reorder-forecast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StockHealthBadge } from "@/components/logistics/stock-health-badge";

export function InventoryKpiCards({ stats }: { stats: InventoryDashboardStats }) {
  const cards: Array<{
    title: string;
    value: number;
    sub: string;
    icon: typeof Package;
    alert?: boolean;
  }> = [
    {
      title: "Total SKU aktif",
      value: stats.totalSkus,
      sub: `${stats.totalUnits.toLocaleString("id-ID")} unit di gudang`,
      icon: Package,
    },
    {
      title: "Perlu perhatian",
      value: stats.criticalCount + stats.lowCount,
      sub: `${stats.criticalCount} kritis · ${stats.lowCount} menipis`,
      icon: AlertTriangle,
      alert: stats.criticalCount > 0,
    },
    {
      title: "Masuk hari ini",
      value: stats.todayIn,
      sub: `${stats.weekIn} unit minggu ini`,
      icon: ArrowDownToLine,
    },
    {
      title: "Keluar hari ini",
      value: stats.todayOut,
      sub: `${stats.weekOut} unit minggu ini`,
      icon: ArrowUpFromLine,
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((c) => (
        <Card key={c.title} className={c.alert ? "border-destructive/40" : undefined}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {c.title}
            </CardTitle>
            <c.icon className="text-muted-foreground size-4" aria-hidden />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">{c.value}</p>
            <p className="text-muted-foreground mt-1 text-xs">{c.sub}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function ReorderAlertPanel({
  items,
}: {
  items: InventoryDashboardStats["reorderList"];
}) {
  if (items.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Boxes className="size-4" />
            Daftar reorder
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Semua SKU dalam batas aman. Tidak ada reorder mendesak.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Boxes className="size-4" />
          Daftar reorder ({items.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.slice(0, 8).map((item) => (
          <div
            key={item.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
          >
            <div className="min-w-0">
              <p className="font-medium truncate">{item.name}</p>
              <p className="text-muted-foreground text-xs">
                {item.brandName} · <span className="font-mono">{item.sku}</span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="tabular-nums text-xs">
                {item.currentStock}/{item.minStock} min
              </span>
              {item.reorderStatus === "ORDER_NOW" ||
              item.reorderStatus === "ORDER_SOON" ? (
                <Badge
                  variant={
                    item.reorderStatus === "ORDER_NOW" ? "destructive" : "secondary"
                  }
                >
                  {reorderStatusLabel(item.reorderStatus)}
                </Badge>
              ) : (
                <StockHealthBadge
                  currentStock={item.currentStock}
                  minStock={item.minStock}
                />
              )}
            </div>
          </div>
        ))}
        {items.length > 8 ? (
          <p className="text-muted-foreground text-xs">
            +{items.length - 8} SKU lain perlu perhatian — lihat tab Stok.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
