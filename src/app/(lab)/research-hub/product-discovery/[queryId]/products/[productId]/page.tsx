import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ResearchBackLink } from "@/components/research-hub/kit/research-locator";
import {
  ShopProductDetailPanel,
  type ShopProductDetailData,
} from "@/components/research-hub/shop-product-detail-panel";
import { mapDiscoveryProductToRow } from "@/lib/research/shop-product-mappers";
import {
  parseShopProductAttributes,
  parseShopProductModels,
  parseShopProductRatingDistribution,
  parseShopProductVariations,
} from "@/lib/research/shop-product-detail-parse";

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
    // Detail halaman produk — terisi bila scraper membuka halaman produknya.
    imageUrls: product.imageUrls,
    priceMin: product.priceMin,
    priceMax: product.priceMax,
    brand: product.brand,
    categoryName: product.categoryName,
    categoryPath: product.categoryPath,
    description: product.description,
    attributes: parseShopProductAttributes(product.attributes),
    variations: parseShopProductVariations(product.variations),
    models: parseShopProductModels(product.models),
    ratingDistribution: parseShopProductRatingDistribution(
      product.ratingDistribution,
    ),
  };

  return (
    <div className="flex w-full flex-col gap-8 pb-12">
      <ShopProductDetailPanel
        product={data}
        breadcrumbs={
          <ResearchBackLink
            href={`/research-hub/product-discovery/${queryId}`}
            label={product.query.keyword}
            className="self-start"
          />
        }
      />
    </div>
  );
}
