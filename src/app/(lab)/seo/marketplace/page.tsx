import { Store } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { SeoModulePage } from "@/components/seo/seo-module-page";
import {
  MarketplaceClient,
  type MarketplaceRow,
} from "./marketplace-client";

export default async function SeoMarketplacePage() {
  const analyses = await prisma.seoMarketplaceAnalysis.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      keyword: true,
      marketplace: true,
      status: true,
      optimizationScore: true,
      ownTitle: true,
      errorMessage: true,
      createdAt: true,
    },
  });

  const rows: MarketplaceRow[] = analyses.map((a) => ({
    id: a.id,
    keyword: a.keyword,
    marketplace: a.marketplace,
    status: a.status,
    optimizationScore: a.optimizationScore,
    hasOwnTitle: !!a.ownTitle,
    errorMessage: a.errorMessage,
    createdAt: a.createdAt.toISOString(),
  }));

  return (
    <SeoModulePage
      icon={Store}
      title="Marketplace SEO"
      description="Riset keyword marketplace (Shopee/Tokopedia/Lazada): analisis listing teratas (pola judul, harga, terjual, rating) + skor optimasi judul produk sendiri."
    >
      <MarketplaceClient analyses={rows} />
    </SeoModulePage>
  );
}
