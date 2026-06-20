import { MessageSquare } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { ResearchHubModulePage } from "@/components/research-hub/research-hub-module-page";
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
    <ResearchHubModulePage
      icon={MessageSquare}
      title="Social Listening"
      description="Monitor percakapan organik TikTok & Instagram — pain points, wishlist, influencer, dan konten viral."
    >
      <SocialListeningClient monitors={rows} />
    </ResearchHubModulePage>
  );
}
