import { prisma } from "@/lib/prisma";
import { ensureLogisticsPage } from "@/lib/ensure-logistics-page";
import { ProductsClient } from "./products-client";

export default async function ProductsPage() {
  await ensureLogisticsPage();
  const [products, brands] = await Promise.all([
    prisma.product.findMany({
      include: { brand: true },
      orderBy: { name: "asc" },
    }),
    prisma.brand.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Produk & SKU</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Registri SKU per brand, stok, ambang minimum, dan tahap pipeline.
        </p>
      </div>
      <ProductsClient products={products} brands={brands} />
    </div>
  );
}
