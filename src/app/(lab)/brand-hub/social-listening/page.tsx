import { MessageSquare } from "lucide-react";
import { BrandHubListPage } from "@/components/brand-hub/brand-hub-list-page";
import { listResearchSocialMonitorsForBrandHub, countResearchSocialThumbnailMentions } from "@/lib/brand-research/research-hub-readers";
import { ensureBrandHubPage } from "../layout";
import {
  BrandSocialListeningClient,
  type SocialMonitorRow,
} from "./brand-social-listening-client";

export default async function BrandSocialListeningPage() {
  await ensureBrandHubPage();

  const monitors = await listResearchSocialMonitorsForBrandHub();

  const rows: SocialMonitorRow[] = await Promise.all(
    monitors.map(async (m) => {
      const latest = m.batches[0];
      const thumbnailMentionCount =
        latest?.status === "READY" && latest.id
          ? await countResearchSocialThumbnailMentions(latest.id)
          : 0;
      return {
        id: m.id,
        name: m.name,
        keywords: m.keywords,
        platforms: m.platforms,
        isActive: m.isActive,
        latestStatus: latest?.status ?? null,
        mentionCount: latest?._count.mentions ?? 0,
        thumbnailMentionCount,
        collectedAt: latest?.collectedAt?.toISOString() ?? null,
        errorMessage: latest?.errorMessage ?? null,
      };
    }),
  );

  return (
    <BrandHubListPage
      icon={MessageSquare}
      eyebrow="Market Intelligence"
      title="Social Listening"
      subtitle="Data monitor sosial dari Research Hub. Lihat insight dan harvest visual ke library."
    >
      <BrandSocialListeningClient monitors={rows} />
    </BrandHubListPage>
  );
}
