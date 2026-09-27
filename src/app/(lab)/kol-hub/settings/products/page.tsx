import type { Metadata } from "next";
import { PackageSearch } from "lucide-react";
import { LabModulePage } from "@/components/lab/lab-module-page";
import { listBrandOptions, listProductsForPricing } from "@/lib/kol/readers";
import { ProductsPriceClient } from "./products-client";

export const metadata: Metadata = { title: "Harga produk · KOL Hub" };

export default async function KolProductPricesPage({
  searchParams,
}: {
  searchParams: Promise<{ brand?: string }>;
}) {
  const { brand } = await searchParams;
  const [products, brands] = await Promise.all([
    listProductsForPricing(brand || null),
    listBrandOptions(),
  ]);
  return (
    <LabModulePage
      icon={PackageSearch}
      eyebrow="Master data"
      title="Harga produk"
      description="Produk diambil dari master Products DCC — tidak perlu input ulang. Isi harga jual supaya nilai barter tiap jadwal tercatat."
    >
      <ProductsPriceClient products={products} brands={brands} />
    </LabModulePage>
  );
}
