"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Vendor } from "@prisma/client";
import { computeInventoryDashboard } from "@/lib/inventory-metrics";
import type { ProductReorderForecast } from "@/lib/reorder-forecast";
import { isSystemStockLog, parseSystemMeta } from "@/lib/stock-log-utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AuditPanel } from "./audit-panel";
import { InventoryOverview } from "./inventory-overview";
import { MovementsPanel } from "./movements-panel";
import { StockReorderPanel } from "./stock-reorder-panel";
import type { InventoryProductRow, StockLogRow } from "./types";

const TABS = ["ringkasan", "mutasi", "stok", "audit"] as const;
type TabValue = (typeof TABS)[number];

export function InventoryTabs({
  products,
  logs,
  vendors,
  forecasts,
  windowDays,
}: {
  products: InventoryProductRow[];
  logs: StockLogRow[];
  vendors: Vendor[];
  forecasts: ProductReorderForecast[];
  windowDays: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const rawTab = searchParams?.get("tab") ?? "ringkasan";
  const tab: TabValue = (TABS as readonly string[]).includes(rawTab)
    ? (rawTab as TabValue)
    : "ringkasan";
  const statusParam = searchParams?.get("status") ?? undefined;

  const setTab = useCallback(
    (next: string, extra?: Record<string, string | null>) => {
      const sp = new URLSearchParams(searchParams?.toString() ?? "");
      sp.set("tab", next);
      for (const [k, v] of Object.entries(extra ?? {})) {
        if (v === null) sp.delete(k);
        else sp.set(k, v);
      }
      router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  const brands = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of products) map.set(p.brand.id, p.brand.name);
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [products]);

  const stats = useMemo(
    () => computeInventoryDashboard(products, logs, forecasts),
    [products, logs, forecasts],
  );

  const businessLogs = useMemo(
    () => logs.filter((l) => !isSystemStockLog(l.note)),
    [logs],
  );
  const correctionLogs = useMemo(
    () => logs.filter((l) => isSystemStockLog(l.note)),
    [logs],
  );

  const statusById = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of correctionLogs) {
      const meta = parseSystemMeta(row);
      if (!meta.targetId || !meta.action) continue;
      const current = map.get(meta.targetId);
      const next =
        meta.action === "VOID"
          ? "Di-void"
          : meta.action === "REPLACEMENT"
            ? "Dikoreksi"
            : "Dibalik";
      if (current === "Di-void") continue;
      map.set(meta.targetId, next);
    }
    return map;
  }, [correctionLogs]);

  const replacementByTargetId = useMemo(() => {
    const map = new Map<string, StockLogRow>();
    for (const row of correctionLogs) {
      const meta = parseSystemMeta(row);
      if (meta.action !== "REPLACEMENT" || !meta.targetId) continue;
      const prev = map.get(meta.targetId);
      if (!prev || row.createdAt > prev.createdAt) map.set(meta.targetId, row);
    }
    return map;
  }, [correctionLogs]);

  const attentionCount = forecasts.filter(
    (f) => f.status === "ORDER_NOW" || f.status === "ORDER_SOON",
  ).length;

  return (
    <Tabs value={tab} onValueChange={(v) => v && setTab(v)}>
      <TabsList className="w-full justify-start overflow-x-auto">
        <TabsTrigger value="ringkasan">Ringkasan</TabsTrigger>
        <TabsTrigger value="mutasi">Mutasi ({businessLogs.length})</TabsTrigger>
        <TabsTrigger value="stok">
          Stok &amp; Reorder{attentionCount > 0 ? ` (${attentionCount})` : ""}
        </TabsTrigger>
        <TabsTrigger value="audit">Audit ({correctionLogs.length})</TabsTrigger>
      </TabsList>

      <TabsContent value="ringkasan" className="mt-4">
        <InventoryOverview
          stats={stats}
          recentLogs={businessLogs}
          onSeeAllReorder={() => setTab("stok", { status: "attention" })}
          onSeeAllMovements={() => setTab("mutasi")}
        />
      </TabsContent>

      <TabsContent value="mutasi" className="mt-4">
        <MovementsPanel
          businessLogs={businessLogs}
          brands={brands}
          statusById={statusById}
          replacementByTargetId={replacementByTargetId}
          products={products}
          vendors={vendors}
        />
      </TabsContent>

      <TabsContent value="stok" className="mt-4">
        <StockReorderPanel
          key={statusParam ?? "none"}
          forecasts={forecasts}
          windowDays={windowDays}
          initialStatus={statusParam}
        />
      </TabsContent>

      <TabsContent value="audit" className="mt-4">
        <AuditPanel correctionLogs={correctionLogs} />
      </TabsContent>
    </Tabs>
  );
}
