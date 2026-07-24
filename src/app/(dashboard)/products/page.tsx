import { Package } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { ensureLogisticsPage } from "@/lib/ensure-logistics-page";
import {
  computeReorderForecasts,
  forecastProductInclude,
  toForecastProductInput,
} from "@/lib/reorder-forecast";
import { getStockHealth } from "@/lib/stock-status";
import { PageHero, PageHeroChip } from "@/components/page-hero";
import { ProductsClient } from "./products-client";

export default async function ProductsPage() {
  await ensureLogisticsPage();
  const [products, brands, vendors] = await Promise.all([
    prisma.product.findMany({
      include: {
        brand: true,
        ...forecastProductInclude,
      },
      orderBy: [{ brand: { name: "asc" } }, { name: "asc" }],
    }),
    prisma.brand.findMany({ orderBy: { name: "asc" } }),
    prisma.vendor.findMany({ orderBy: { name: "asc" } }),
  ]);

  const forecasts = await computeReorderForecasts(
    products.map((p) => toForecastProductInput(p)),
    90,
  );

  const criticalCount = products.filter(
    (p) => getStockHealth(p.currentStock, p.minStock) === "CRITICAL",
  ).length;

  return (
    <div className="flex w-full flex-col gap-6">
      <PageHero
        variant="compact"
        icon={Package}
        title="Produk & SKU"
        subtitle="Master data SKU — brand, reorder point, rantai vendor, dan tahap pipeline. Stok hanya berubah lewat mutasi atau penyesuaian inventori."
      >
        <div className="flex flex-wrap gap-1.5 pt-1">
          <PageHeroChip>{products.length} SKU aktif</PageHeroChip>
          {criticalCount > 0 ? (
            <PageHeroChip>
              <span className="bg-danger inline-block size-1.5 rounded-full" aria-hidden />
              {criticalCount} stok kritis
            </PageHeroChip>
          ) : null}
        </div>
      </PageHero>
      <ProductsClient
        products={products}
        brands={brands}
        vendors={vendors}
        forecasts={forecasts}
      />
    </div>
  );
}
