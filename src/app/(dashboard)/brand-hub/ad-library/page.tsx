import { Megaphone } from "lucide-react";
import { SocialListeningStatus } from "@prisma/client";
import { BrandHubListPage } from "@/components/brand-hub/brand-hub-list-page";
import { listBrandAdLibraryMonitors } from "@/lib/brand-research/scrape-meta-ads";
import { ensureBrandHubPage } from "../layout";
import {
  BrandAdLibraryClient,
  type AdLibraryMonitorRow,
} from "./brand-ad-library-client";

export default async function BrandAdLibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ brandId?: string }>;
}) {
  await ensureBrandHubPage();
  const { brandId } = await searchParams;

  const monitors = await listBrandAdLibraryMonitors(brandId ?? null);

  const rows: AdLibraryMonitorRow[] = monitors.map((m) => {
    const latest = m.batches[0];
    return {
      id: m.id,
      name: m.name,
      searchTerms: m.searchTerms,
      adLibraryUrls: m.adLibraryUrls,
      country: m.country,
      mediaType: m.mediaType,
      adCount: m._count.ads,
      latestStatus: (latest?.status as SocialListeningStatus) ?? null,
      errorMessage: latest?.errorMessage ?? null,
      collectedAt: latest?.collectedAt?.toISOString() ?? null,
      aiSummary: m.aiSummary,
    };
  });

  return (
    <BrandHubListPage
      icon={Megaphone}
      eyebrow="Creative Intelligence"
      title="Ad Library"
      subtitle="Kumpulkan iklan Meta kompetitor — analisis hook, CTA, dan format kreatif untuk tim branding."
    >
      <BrandAdLibraryClient monitors={rows} />
    </BrandHubListPage>
  );
}
