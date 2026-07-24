"use client";

import { StockLogType } from "@prisma/client";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { History } from "lucide-react";
import type { InventoryDashboardStats } from "@/lib/inventory-metrics";
import { InventoryKpiCards } from "@/components/logistics/inventory-kpi-cards";
import { MovementTypeBadge } from "@/components/logistics/movement-type-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReorderTeaser } from "./reorder-teaser";
import type { StockLogRow } from "./types";

export function InventoryOverview({
  stats,
  recentLogs,
  onSeeAllReorder,
  onSeeAllMovements,
}: {
  stats: InventoryDashboardStats;
  recentLogs: StockLogRow[];
  onSeeAllReorder: () => void;
  onSeeAllMovements: () => void;
}) {
  return (
    <div className="space-y-6">
      <InventoryKpiCards stats={stats} />
      <div className="grid gap-6 xl:grid-cols-2">
        <ReorderTeaser items={stats.reorderList} onSeeAll={onSeeAllReorder} />
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="size-4" aria-hidden />
              Mutasi terakhir
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentLogs.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Belum ada mutasi tercatat.
              </p>
            ) : (
              <>
                {recentLogs.slice(0, 8).map((log) => (
                  <div
                    key={log.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{log.product.name}</p>
                      <p className="text-muted-foreground text-xs">
                        {format(log.createdAt, "d MMM, HH:mm", { locale: idLocale })}
                        {log.reference ? (
                          <span className="font-mono"> · {log.reference}</span>
                        ) : null}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium tabular-nums">
                        {log.type === StockLogType.IN ? "+" : "−"}
                        {log.amount}
                      </span>
                      <MovementTypeBadge
                        type={log.type === StockLogType.IN ? "IN" : "OUT"}
                      />
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={onSeeAllMovements}
                  className="text-accent-foreground text-xs font-medium hover:underline"
                >
                  Lihat semua mutasi
                </button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
