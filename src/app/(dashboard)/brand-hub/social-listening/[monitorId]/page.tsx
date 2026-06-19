import { notFound } from "next/navigation";
import { SocialListeningPlatform, SocialMentionClass } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { countResearchSocialThumbnailMentions } from "@/lib/brand-research/research-hub-readers";
import { platformStatusMessage } from "@/lib/research/social-listening/platform-scrape-runner";
import {
  BrandSocialDetailClient,
  type SocialDetailData,
} from "./brand-social-detail-client";
import { parseResearchAiMetaClient } from "@/lib/research/research-module-models";

export default async function SocialListeningDetailPage({
  params,
}: {
  params: Promise<{ monitorId: string }>;
}) {
  const { monitorId } = await params;

  const monitor = await prisma.socialListeningMonitor.findUnique({
    where: { id: monitorId },
    include: {
      batches: {
        where: { status: "READY" },
        orderBy: { collectedAt: "desc" },
        take: 1,
        include: {
          summary: true,
          mentions: { orderBy: { likes: "desc" }, take: 100 },
        },
      },
    },
  });

  if (!monitor) notFound();

  const latest = monitor.batches[0];
  const latestAny = await prisma.socialListeningBatch.findFirst({
    where: { monitorId },
    orderBy: { createdAt: "desc" },
  });

  const thumbnailMentionCount = latest
    ? await countResearchSocialThumbnailMentions(latest.id)
    : 0;

  const platformStatusRaw =
    latestAny?.platformStatus && typeof latestAny.platformStatus === "object"
      ? (latestAny.platformStatus as Record<string, string>)
      : {};
  const apifyRunIdsRaw =
    latestAny?.apifyRunIds && typeof latestAny.apifyRunIds === "object"
      ? (latestAny.apifyRunIds as Record<string, string | string[]>)
      : {};

  const platformProgress = monitor.platforms.map((platform) => {
    const status = platformStatusRaw[platform] ?? null;
    const runId = apifyRunIdsRaw[platform];
    return {
      platform,
      status,
      message:
        status && status !== "READY"
          ? platformStatusMessage(
              platform as SocialListeningPlatform,
              status as "COLLECTING" | "READY" | "FAILED" | "SKIPPED",
              runId,
            )
          : status === "READY"
            ? platformStatusMessage(platform as SocialListeningPlatform, "READY")
            : null,
    };
  });

  const painPoints = Array.isArray(latest?.summary?.topPainPoints)
    ? (latest.summary.topPainPoints as { theme: string; count: number }[])
    : [];
  const wishlist = Array.isArray(latest?.summary?.topWishlist)
    ? (latest.summary.topWishlist as { theme: string; count: number }[])
    : [];
  const influencers = Array.isArray(latest?.summary?.influencers)
    ? (latest.summary.influencers as SocialDetailData["influencers"])
    : [];
  const viral = Array.isArray(latest?.summary?.viralContent)
    ? (latest.summary.viralContent as SocialDetailData["viralContent"])
    : [];
  const categoryBreakdown = Array.isArray(latest?.summary?.categoryBreakdown)
    ? (latest.summary.categoryBreakdown as SocialDetailData["categoryBreakdown"])
    : [];
  const sentimentTimeline = Array.isArray(latest?.summary?.sentimentTimeline)
    ? (latest.summary.sentimentTimeline as SocialDetailData["sentimentTimeline"])
    : [];

  const data: SocialDetailData = {
    id: monitor.id,
    name: monitor.name,
    keywords: monitor.keywords,
    platforms: monitor.platforms,
    batchStatus: latestAny?.status ?? null,
    batchId: latestAny?.id ?? null,
    platformProgress,
    errorMessage: latestAny?.errorMessage ?? null,
    aiSummary: latest?.summary?.aiSummary ?? null,
    topPainPoints: painPoints,
    topWishlist: wishlist,
    influencers,
    viralContent: viral,
    categoryBreakdown,
    sentimentTimeline,
    actionPlan: latest?.summary?.aiActionPlan ?? null,
    aiMeta: parseResearchAiMetaClient(latest?.summary?.aiMeta),
    mentions:
      latest?.mentions.map((m) => ({
        id: m.id,
        platform: m.platform,
        text: m.text,
        author: m.author,
        classification: m.classification as SocialMentionClass,
        likes: m.likes,
        views: m.views,
        isViral: m.isViral,
        url: m.url,
      })) ?? [],
    thumbnailMentionCount,
  };

  return (
    <div className="flex w-full flex-col gap-6 pb-6">
      <BrandSocialDetailClient data={data} />
    </div>
  );
}
