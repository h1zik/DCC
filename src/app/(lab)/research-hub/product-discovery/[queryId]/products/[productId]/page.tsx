import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { LabPageShell } from "@/components/lab/lab-primitives";
import {
  ShopProductDetailPanel,
  type ShopProductDetailData,
} from "@/components/research-hub/shop-product-detail-panel";
import { mapDiscoveryProductToRow } from "@/lib/research/shop-product-mappers";
import { Button } from "@/components/ui/button";

export default async function ProductDiscoveryProductDetailPage({
  params,
}: {
  params: Promise<{ queryId: string; productId: string }>;
}) {
  const { queryId, productId } = await params;

  const product = await prisma.productDiscoveryItem.findFirst({
    where: { id: productId, queryId },
    include: { query: { select: { keyword: true } } },
  });
  if (!product) notFound();

  const row = mapDiscoveryProductToRow(product);

  const data: ShopProductDetailData = {
    id: row.id,
    name: row.name,
    productUrl: row.productUrl,
    imageUrl: row.imageUrl,
    marketplace: row.marketplace,
    shopName: row.shopName,
    shopLocation: row.shopLocation ?? null,
    isOfficialShop: row.isOfficialShop ?? false,
    price: row.price,
    rating: row.rating,
    reviewCount: row.reviewCount,
    soldCount: row.soldCount,
    hasPromo: row.hasPromo,
    promoText: row.promoText,
    categoryRank: row.categoryRank,
    exactSold: row.exactSold,
    historicalSold: row.historicalSold,
    monthlySold: row.monthlySold,
    estimatedRevenue: row.estimatedRevenue,
    stock: row.stock,
  };

  return (
    <LabPageShell>
      <ShopProductDetailPanel
        product={data}
        breadcrumbs={
          <Button
            size="sm"
            variant="ghost"
            className="w-fit gap-1 px-0"
            render={
              <Link href={`/research-hub/product-discovery/${queryId}`} />
            }
          >
            <ChevronLeft className="size-4" />
            Kembali ke {product.query.keyword}
          </Button>
        }
      />
    </LabPageShell>
  );
}
