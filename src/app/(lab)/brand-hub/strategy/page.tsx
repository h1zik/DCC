import { Compass } from "lucide-react";
import { BrandHubListPage } from "@/components/brand-hub/brand-hub-list-page";
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
    <BrandHubListPage
      icon={Compass}
      eyebrow="Studio"
      title="Brand Strategy"
      subtitle="Dokumen strategi brand — purpose, essence, USP branding, STP, personality, dan tone of voice berbasis evidence pasar."
    >
      <BrandStrategyClient
        documents={data.documents as StrategyDocumentView[]}
        evidenceReadiness={data.evidenceReadiness}
        sourceCatalog={data.sourceCatalog}
        defaultGenerationConfig={data.defaultGenerationConfig}
        defaultBrandId={brandId ?? null}
      />
    </BrandHubListPage>
  );
}
