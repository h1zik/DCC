import { notFound } from "next/navigation";
import { SocialListeningPlatform, SocialMentionClass } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ResearchHubPageShell } from "@/components/research-hub/research-hub-primitives";
import { platformStatusMessage } from "@/lib/research/social-listening/platform-scrape-runner";
import {
  SocialDetailClient,
  type SocialDetailData,
} from "./social-detail-client";
import { resolveSearchLimits } from "@/lib/research/social-listening/search-limits";
import { parseResearchAiMetaClient } from "@/lib/research/research-module-models";
import {
  parseCategoryBreakdown,
  parseEngagementInsights,
  parseThemeRows,
} from "@/lib/research/social-listening/parse-summary-client";

const batchInclude = {
  summary: true,
  mentions: { orderBy: { likes: "desc" as const }, take: 100 },
  comments: { orderBy: { likes: "desc" as const }, take: 80 },
};

export default async function SocialListeningDetailPage({
  params,
}: {
  params: Promise<{ monitorId: string }>;
}) {
  const { monitorId } = await params;

  const monitor = await prisma.socialListeningMonitor.findUnique({
    where: { id: monitorId },
  });

  if (!monitor) notFound();

  const latestAny = await prisma.socialListeningBatch.findFirst({
    where: { monitorId },
    orderBy: { createdAt: "desc" },
    include: batchInclude,
  });

  const latestReady = await prisma.socialListeningBatch.findFirst({
    where: { monitorId, status: "READY" },
    orderBy: { collectedAt: "desc" },
    include: batchInclude,
  });

  const displayBatch =
    latestAny &&
    (latestAny.status === "READY" ||
      latestAny.status === "ANALYZING" ||
      latestAny.status === "COLLECTING")
      ? latestAny
      : latestReady;

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
  const rooms = await prisma.room.findMany({
    select: {
      id: true,
      name: true,
      brandId: true,
      brand: { select: { name: true } },
    },
    orderBy: { name: "asc" },
  });

  const painPoints = parseThemeRows(displayBatch?.summary?.topPainPoints);
  const wishlist = parseThemeRows(displayBatch?.summary?.topWishlist);
  const topCommentPainPoints = parseThemeRows(
    displayBatch?.summary?.topCommentPainPoints,
  );
  const topCommentWishlist = parseThemeRows(
    displayBatch?.summary?.topCommentWishlist,
  );
  const commentCategoryBreakdown = parseCategoryBreakdown(
    displayBatch?.summary?.commentCategoryBreakdown,
  );
  const engagementInsights = parseEngagementInsights(
    displayBatch?.summary?.engagementInsights,
  );
  const influencers = Array.isArray(displayBatch?.summary?.influencers)
    ? (displayBatch.summary.influencers as SocialDetailData["influencers"])
    : [];
  const viral = Array.isArray(displayBatch?.summary?.viralContent)
    ? (displayBatch.summary.viralContent as SocialDetailData["viralContent"])
    : [];
  const categoryBreakdown = Array.isArray(displayBatch?.summary?.categoryBreakdown)
    ? (displayBatch.summary.categoryBreakdown as SocialDetailData["categoryBreakdown"])
    : [];
  const sentimentTimeline = Array.isArray(displayBatch?.summary?.sentimentTimeline)
    ? (displayBatch.summary.sentimentTimeline as SocialDetailData["sentimentTimeline"])
    : [];

  const scrapeLimits = resolveSearchLimits(monitor);

  const data: SocialDetailData = {
    id: monitor.id,
    name: monitor.name,
    keywords: monitor.keywords,
    platforms: monitor.platforms,
    tiktokSearchLimit: scrapeLimits.tiktok,
    instagramSearchLimit: scrapeLimits.instagram,
    batchStatus: latestAny?.status ?? null,
    batchId: latestAny?.id ?? null,
    platformProgress,
    aiSummary: displayBatch?.summary?.aiSummary ?? null,
    topPainPoints: painPoints,
    topWishlist: wishlist,
    influencers,
    viralContent: viral,
    categoryBreakdown,
    sentimentTimeline,
    actionPlan: displayBatch?.summary?.aiActionPlan ?? null,
    aiMeta: parseResearchAiMetaClient(displayBatch?.summary?.aiMeta),
    engagementInsights,
    commentAiSummary: displayBatch?.summary?.commentAiSummary ?? null,
    topCommentPainPoints,
    topCommentWishlist,
    commentCategoryBreakdown,
    comments:
      displayBatch?.comments.map((c) => ({
        id: c.id,
        text: c.text,
        author: c.author,
        platform: c.platform,
        classification: c.classification as SocialMentionClass,
        likes: c.likes,
        painPoint: c.painPoint,
      })) ?? [],
    mentions:
      displayBatch?.mentions.map((m) => ({
        id: m.id,
        platform: m.platform,
        text: m.text,
        author: m.author,
        classification: m.classification as SocialMentionClass,
        likes: m.likes,
        comments: m.comments,
        views: m.views,
        isViral: m.isViral,
        url: m.url,
      })) ?? [],
    rooms: rooms.map((r) => ({
      id: r.id,
      name: r.name,
      brandId: r.brandId,
      brandName: r.brand?.name ?? null,
    })),
  };

  return (
    <ResearchHubPageShell>
      <SocialDetailClient data={data} />
    </ResearchHubPageShell>
  );
}
