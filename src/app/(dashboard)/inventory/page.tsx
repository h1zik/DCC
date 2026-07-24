import { PenLine, Warehouse } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { ensureLogisticsPage } from "@/lib/ensure-logistics-page";
import {
  computeReorderForecasts,
  forecastProductInclude,
  toForecastProductInput,
} from "@/lib/reorder-forecast";
import { PageHero, PageHeroChip } from "@/components/page-hero";
import { StockMovementSheet } from "@/components/logistics/stock-movement-sheet";
import { Button } from "@/components/ui/button";
import { InventoryTabs } from "./inventory-tabs";

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ window?: string; tab?: string; status?: string }>;
}) {
  await ensureLogisticsPage();
  const sp = await searchParams;
  const rawWindow = Number(sp.window);
  const windowDays =
    rawWindow === 30 || rawWindow === 60 || rawWindow === 90 ? rawWindow : 90;

  const [products, logs, vendors] = await Promise.all([
    prisma.product.findMany({
      include: {
        brand: true,
        ...forecastProductInclude,
      },
      orderBy: [{ brand: { name: "asc" } }, { name: "asc" }],
    }),
    prisma.stockLog.findMany({
      include: {
        product: {
          include: {
            brand: true,
            preferredVendor: { select: { id: true, name: true } },
            productVendors: {
              orderBy: { sortOrder: "asc" },
              include: { vendor: { select: { id: true, name: true } } },
            },
          },
        },
        vendor: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 2000,
    }),
    prisma.vendor.findMany({ orderBy: { name: "asc" } }),
  ]);

  const forecasts = await computeReorderForecasts(
    products.map((p) => toForecastProductInput(p)),
    windowDays,
  );

  const totalUnits = products.reduce((sum, p) => sum + p.currentStock, 0);

  return (
    <div className="flex w-full flex-col gap-6">
      <PageHero
        variant="compact"
        icon={Warehouse}
        title="Inventori"
        subtitle="Pusat kontrol stok — catat mutasi, pantau reorder & forecast, dan audit ledger."
        right={
          <StockMovementSheet
            products={products}
            vendors={vendors}
            trigger={
              <Button className="gap-1.5">
                <PenLine className="size-4" />
                Catat mutasi
              </Button>
            }
          />
        }
      >
        <div className="flex flex-wrap gap-1.5 pt-1">
          <PageHeroChip>{products.length} SKU</PageHeroChip>
          <PageHeroChip>{totalUnits.toLocaleString("id-ID")} unit</PageHeroChip>
        </div>
      </PageHero>
      <InventoryTabs
        products={products}
        logs={logs}
        vendors={vendors}
        forecasts={forecasts}
        windowDays={windowDays}
      />
    </div>
  );
}
