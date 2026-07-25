"use client";

import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { Vendor } from "@prisma/client";
import {
  computeInventoryDashboard,
  forecastNeedsAttention,
} from "@/lib/inventory-metrics";
import type { ProductReorderForecast } from "@/lib/reorder-forecast";
import { getStockHealth } from "@/lib/stock-status";
import { isSystemStockLog, parseSystemMeta } from "@/lib/stock-log-utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AuditPanel } from "./audit-panel";
import { InventoryOverview } from "./inventory-overview";
import {
  DEFAULT_MOVEMENT_FILTERS,
  MovementsPanel,
  type MovementFilters,
} from "./movements-panel";
import {
  DEFAULT_STOCK_FILTERS,
  normalizeStockStatus,
  StockReorderPanel,
  type StockFilters,
} from "./stock-reorder-panel";
import type { InventoryProductRow, StockLogRow } from "./types";

const TABS = ["ringkasan", "mutasi", "stok", "audit"] as const;
type TabValue = (typeof TABS)[number];

function isTabValue(value: string): value is TabValue {
  return (TABS as readonly string[]).includes(value);
}

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
  const searchParams = useSearchParams();

  // Deep-link dibaca sekali saat mount; sesudah itu tab & filter murni state
  // klien. `router.replace` di sini akan membuat setiap klik tab me-refetch
  // RSC payload (page.tsx menunggu searchParams) — mahal dan berkedip.
  const [tab, setTabState] = useState<TabValue>(() => {
    const raw = searchParams?.get("tab") ?? "";
    return isTabValue(raw) ? raw : "ringkasan";
  });
  const [stockFilters, setStockFilters] = useState<StockFilters>(() => ({
    ...DEFAULT_STOCK_FILTERS,
    status: normalizeStockStatus(searchParams?.get("status")),
  }));
  const [movementFilters, setMovementFilters] = useState<MovementFilters>(
    DEFAULT_MOVEMENT_FILTERS,
  );

  const setTab = useCallback((next: TabValue) => {
    setTabState(next);
    // history.replaceState tersinkron dengan useSearchParams tanpa render ulang
    // server. `status` dibuang supaya tidak pernah menimpa filter pilihan user.
    const sp = new URLSearchParams(window.location.search);
    sp.set("tab", next);
    sp.delete("status");
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}?${sp.toString()}`,
    );
  }, []);

  const showAttention = useCallback(() => {
    setStockFilters((f) => ({ ...f, status: "attention" }));
    setTab("stok");
  }, [setTab]);

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

  const categoryByProductId = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of products) if (p.category) map.set(p.id, p.category);
    return map;
  }, [products]);

  // Satu definisi "perlu perhatian" untuk KPI card, label tab, dan filter tabel.
  const attention = useMemo(() => {
    let total = 0;
    let reorderOnly = 0;
    for (const f of forecasts) {
      if (!forecastNeedsAttention(f)) continue;
      total++;
      if (getStockHealth(f.currentStock, f.manualMinStock) === "OK") reorderOnly++;
    }
    return { total, reorderOnly };
  }, [forecasts]);

  return (
    <Tabs
      value={tab}
      onValueChange={(v) => {
        if (v && isTabValue(v)) setTab(v);
      }}
    >
      <TabsList className="w-full justify-start overflow-x-auto">
        <TabsTrigger value="ringkasan">Ringkasan</TabsTrigger>
        <TabsTrigger value="mutasi">Mutasi ({businessLogs.length})</TabsTrigger>
        <TabsTrigger value="stok">
          Stok &amp; Reorder{attention.total > 0 ? ` (${attention.total})` : ""}
        </TabsTrigger>
        <TabsTrigger value="audit">Audit ({correctionLogs.length})</TabsTrigger>
      </TabsList>

      <TabsContent value="ringkasan" className="mt-4">
        <InventoryOverview
          stats={stats}
          recentLogs={businessLogs}
          statusById={statusById}
          replacementByTargetId={replacementByTargetId}
          attentionCount={attention.total}
          reorderOnlyCount={attention.reorderOnly}
          onSeeAllReorder={showAttention}
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
          filters={movementFilters}
          onFiltersChange={setMovementFilters}
        />
      </TabsContent>

      <TabsContent value="stok" className="mt-4">
        <StockReorderPanel
          forecasts={forecasts}
          windowDays={windowDays}
          categoryByProductId={categoryByProductId}
          filters={stockFilters}
          onFiltersChange={setStockFilters}
        />
      </TabsContent>

      <TabsContent value="audit" className="mt-4">
        <AuditPanel correctionLogs={correctionLogs} />
      </TabsContent>
    </Tabs>
  );
}
