import { Layers } from "lucide-react";
import { BrandHubListPage } from "@/components/brand-hub/brand-hub-list-page";
import { ensureBrandHubPage } from "../layout";
import { getBrandPortfolioPageData } from "@/actions/brand-portfolio";
import { BrandPortfolioClient } from "./brand-portfolio-client";
import { prisma } from "@/lib/prisma";

export default async function BrandPortfolioPage({
  searchParams,
}: {
  searchParams: Promise<{ brandId?: string }>;
}) {
  await ensureBrandHubPage();
  const { brandId } = await searchParams;

  const brands = await prisma.brand.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const activeBrandId = brandId ?? brands[0]?.id ?? null;
  const data = activeBrandId
    ? await getBrandPortfolioPageData(activeBrandId)
    : { portfolio: null, discoveryOptions: [] };

  return (
    <BrandHubListPage
      icon={Layers}
      eyebrow="Studio"
      title="Brand Portfolio"
      subtitle="Definisikan lini produk yang akan dijual — fondasi sebelum menyusun Brand Strategy multi-SKU."
    >
      <BrandPortfolioClient
        brands={brands}
        brandId={activeBrandId}
        portfolio={data.portfolio}
        discoveryOptions={data.discoveryOptions}
      />
    </BrandHubListPage>
  );
}
