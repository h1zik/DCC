import { Compass } from "lucide-react";
import { PageHero } from "@/components/page-hero";
import { ensureBrandHubPage } from "../layout";
import { getBrandStrategyPageData } from "@/actions/brand-strategy";
import { BrandStrategyClient, type StrategyDocumentView } from "./brand-strategy-client";

export default async function BrandStrategyPage({
  searchParams,
}: {
  searchParams: Promise<{ brandId?: string }>;
}) {
  await ensureBrandHubPage();
  const { brandId } = await searchParams;
  const data = await getBrandStrategyPageData(brandId ?? null);

  return (
    <div className="flex w-full flex-col gap-6 pb-6">
      <PageHero
        icon={Compass}
        title="Brand Strategy"
        subtitle="Dokumen strategi brand — purpose, essence, USP branding, STP, personality, dan tone of voice berbasis evidence pasar."
      />
      <BrandStrategyClient documents={data.documents as StrategyDocumentView[]} />
    </div>
  );
}
