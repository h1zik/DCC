import { MessageSquare } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHero } from "@/components/page-hero";
import {
  SocialListeningClient,
  type SocialMonitorRow,
} from "./social-listening-client";

export default async function SocialListeningPage() {
  const monitors = await prisma.socialListeningMonitor.findMany({
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
        subtitle="Monitor percakapan organik TikTok & Instagram — pain points, wishlist, influencer, dan konten viral."
      />
      <SocialListeningClient monitors={rows} />
    </div>
  );
}
