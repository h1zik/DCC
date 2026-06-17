import { prisma } from "@/lib/prisma";
import { ensureLogisticsPage } from "@/lib/ensure-logistics-page";
import {
  computeReorderForecasts,
  forecastProductInclude,
  toForecastProductInput,
} from "@/lib/reorder-forecast";
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

  return (
    <div className="flex w-full flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Produk & SKU</h1>
        <p className="text-muted-foreground mt-1 max-w-3xl text-sm">
          Master data SKU — brand, reorder point, rantai vendor (maklon, botol,
          packaging), dan tahap pipeline. Perubahan stok hanya melalui mutasi atau
          penyesuaian inventori (audit trail).
        </p>
      </div>
      <ProductsClient
        products={products}
        brands={brands}
        vendors={vendors}
        forecasts={forecasts}
      />
    </div>
  );
}
