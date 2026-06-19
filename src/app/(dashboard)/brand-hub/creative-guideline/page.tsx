import { Sparkles } from "lucide-react";
import { BrandHubListPage } from "@/components/brand-hub/brand-hub-list-page";
import { ensureBrandHubPage } from "../layout";
import { getBrandCreativeGuidelinePageData } from "@/actions/brand-creative-guideline";
import { listBrandVisualAssets } from "@/lib/brand-research/visual";
import { BrandCreativeGuidelineClient, type CreativeGuidelineView } from "./brand-creative-guideline-client";

export default async function BrandCreativeGuidelinePage({
  searchParams,
}: {
  searchParams: Promise<{ brandId?: string }>;
}) {
  const session = await ensureBrandHubPage();
  const { brandId } = await searchParams;
  const data = await getBrandCreativeGuidelinePageData(brandId ?? null);
  const assets = await listBrandVisualAssets(session.user.id, brandId ?? null);

  return (
    <BrandHubListPage
      icon={Sparkles}
      eyebrow="Studio"
      title="Creative Guideline"
      subtitle="Moodboard, color palette, typography, dan design references — creative direction dari strategi brand dan visual library."
    >
      <BrandCreativeGuidelineClient
        guidelines={data.guidelines as CreativeGuidelineView[]}
        strategyOptions={data.strategyOptions}
        moodboardAssets={assets.map((a) => ({
          id: a.id,
          imageUrl: a.imageUrl,
          title: a.title,
        }))}
        selectedGuidelineId={data.guidelines[0]?.id ?? null}
        guidelineReadiness={data.guidelineReadiness}
        visualAssetCount={data.visualAssetCount}
        defaultBrandId={brandId ?? null}
      />
    </BrandHubListPage>
  );
}
