import { notFound } from "next/navigation";
import { SocialMentionClass } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  SocialDetailClient,
  type SocialDetailData,
} from "./social-detail-client";

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

  const rooms = await prisma.room.findMany({
    select: {
      id: true,
      name: true,
      brandId: true,
      brand: { select: { name: true } },
    },
    orderBy: { name: "asc" },
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

  const data: SocialDetailData = {
    id: monitor.id,
    name: monitor.name,
    keywords: monitor.keywords,
    platforms: monitor.platforms,
    batchStatus: latestAny?.status ?? null,
    errorMessage: latestAny?.errorMessage ?? null,
    aiSummary: latest?.summary?.aiSummary ?? null,
    topPainPoints: painPoints,
    topWishlist: wishlist,
    influencers,
    viralContent: viral,
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
    rooms: rooms.map((r) => ({
      id: r.id,
      name: r.name,
      brandId: r.brandId,
      brandName: r.brand?.name ?? null,
    })),
  };

  return (
    <div className="flex w-full flex-col gap-6 pb-6">
      <SocialDetailClient data={data} />
    </div>
  );
}
