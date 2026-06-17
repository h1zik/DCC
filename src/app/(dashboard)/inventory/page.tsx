import { prisma } from "@/lib/prisma";
import { ensureLogisticsPage } from "@/lib/ensure-logistics-page";
import {
  computeReorderForecasts,
  forecastProductInclude,
  toForecastProductInput,
} from "@/lib/reorder-forecast";
import { InventoryClient } from "./inventory-client";

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ window?: string }>;
}) {
  await ensureLogisticsPage();
  const sp = await searchParams;
  const rawWindow = Number(sp.window);
  const windowDays = rawWindow === 30 || rawWindow === 60 || rawWindow === 90 ? rawWindow : 90;

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

  return (
    <div className="flex w-full flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Inventori</h1>
        <p className="text-muted-foreground mt-1 max-w-3xl text-sm">
          Pusat kontrol stok — catat masuk/keluar, pantau alert reorder, forecast burn
          rate, dan audit mutasi. Semua perubahan stok tercatat di buku besar (ledger).
        </p>
      </div>
      <InventoryClient
        products={products}
        logs={logs}
        vendors={vendors}
        forecasts={forecasts}
        windowDays={windowDays}
      />
    </div>
  );
}
