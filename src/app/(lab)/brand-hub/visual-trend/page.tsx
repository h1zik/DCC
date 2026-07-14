import { TrendingUp } from "lucide-react";
import { BrandHubListPage } from "@/components/brand-hub/brand-hub-list-page";
import { buildVisualTrendAnalytics } from "@/lib/brand-research/visual-trend-analytics";
import { getLatestResearchTrendDigestWithItems } from "@/lib/brand-research/research-hub-readers";
import { ensureBrandHubPage } from "../layout";
import { BrandVisualTrendClient } from "./brand-visual-trend-client";

export default async function BrandVisualTrendPage({
  searchParams,
}: {
  searchParams: Promise<{ brandId?: string }>;
}) {
  const session = await ensureBrandHubPage();
  const { brandId } = await searchParams;

  const [collections, researchTrend] = await Promise.all([
    buildVisualTrendAnalytics(session.user.id, brandId ?? null),
    getLatestResearchTrendDigestWithItems(),
  ]);

  const marketContext =
    researchTrend?.items.map((item) => ({
      id: item.id,
      title: item.name,
      score: item.score ?? 0,
      phase: item.phase,
      source: item.dimension,
    })) ?? [];

  return (
    <BrandHubListPage
      icon={TrendingUp}
      eyebrow="Creative Intelligence"
      title="Visual Trend"
      subtitle="Analisis estetika dari koleksi Pinterest di Visual Library — plus cuplikan konteks pasar dari Research Hub."
    >
      <BrandVisualTrendClient
        collections={collections}
        marketContext={marketContext}
        marketNarrative={researchTrend?.narrative ?? null}
      />
    </BrandHubListPage>
  );
}
