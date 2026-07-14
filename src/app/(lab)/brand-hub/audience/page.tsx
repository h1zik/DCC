import { Users } from "lucide-react";
import { BrandHubListPage } from "@/components/brand-hub/brand-hub-list-page";
import { ensureBrandHubPage } from "../layout";
import { getBrandAudiencePageData } from "@/actions/brand-audience";
import {
  BrandAudienceClient,
  type AudienceProfileView,
} from "./audience-client";

export default async function BrandAudiencePage({
  searchParams,
}: {
  searchParams: Promise<{ brandId?: string }>;
}) {
  await ensureBrandHubPage();
  const { brandId } = await searchParams;
  const data = await getBrandAudiencePageData(brandId ?? null);

  return (
    <BrandHubListPage
      icon={Users}
      eyebrow="Studio"
      title="Audience Persona"
      subtitle="Persona target market brand — pain point, harapan, motivasi, dan kebiasaan beli, disintesis AI dari voice-of-customer (review, social, keyword)."
    >
      <BrandAudienceClient
        profiles={data.profiles as AudienceProfileView[]}
        evidenceReadiness={data.evidenceReadiness}
        defaultBrandId={brandId ?? null}
      />
    </BrandHubListPage>
  );
}
