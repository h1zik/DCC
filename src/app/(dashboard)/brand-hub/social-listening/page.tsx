import { MessageSquare } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHero } from "@/components/page-hero";
import { ensureBrandHubPage } from "../layout";
import {
  BrandSocialListeningClient,
  type SocialMonitorRow,
} from "./brand-social-listening-client";

export default async function BrandSocialListeningPage() {
  const session = await ensureBrandHubPage();

  const monitors = await prisma.brandSocialMonitor.findMany({
    where: { createdById: session.user.id },
    orderBy: { createdAt: "desc" },
    include: {
      batches: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: {
          _count: { select: { mentions: true } },
        },
      },
    },
  });

  const rows: SocialMonitorRow[] = monitors.map((m) => {
    const latest = m.batches[0];
    return {
      id: m.id,
      name: m.name,
      keywords: m.keywords,
      platforms: m.platforms,
      isActive: m.isActive,
      latestStatus: latest?.status ?? null,
      mentionCount: latest?._count.mentions ?? 0,
      collectedAt: latest?.collectedAt?.toISOString() ?? null,
      errorMessage: latest?.errorMessage ?? null,
    };
  });

  return (
    <div className="flex w-full flex-col gap-6 pb-6">
      <PageHero
        icon={MessageSquare}
        title="Social Listening"
        subtitle="Monitor mentions, share of voice, dan sentiment brand vs kompetitor."
      />
      <BrandSocialListeningClient monitors={rows} />
    </div>
  );
}
