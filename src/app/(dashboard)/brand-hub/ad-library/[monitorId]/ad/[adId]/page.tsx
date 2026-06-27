import { notFound } from "next/navigation";
import { ensureBrandHubPage } from "../../../../layout";
import { prisma } from "@/lib/prisma";
import { enrichAdMediaFromRaw } from "@/lib/apify/normalize-meta-ads";
import {
  computeDaysRunning,
  scoreAdWinning,
} from "@/lib/brand-research/ad-winning-score";
import {
  BrandAdDetailClient,
  type AdDetailCard,
  type AdDetailData,
} from "./brand-ad-detail-client";

function parseCards(raw: unknown): AdDetailCard[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((c): c is Record<string, unknown> => !!c && typeof c === "object")
    .map((c) => ({
      imageUrl: typeof c.imageUrl === "string" ? c.imageUrl : null,
      videoUrl: typeof c.videoUrl === "string" ? c.videoUrl : null,
      title: typeof c.title === "string" ? c.title : null,
      body: typeof c.body === "string" ? c.body : null,
      linkUrl: typeof c.linkUrl === "string" ? c.linkUrl : null,
    }));
}

export default async function BrandAdDetailPage({
  params,
}: {
  params: Promise<{ monitorId: string; adId: string }>;
}) {
  await ensureBrandHubPage();
  const { monitorId, adId } = await params;

  const ad = await prisma.brandAdLibraryAd.findFirst({
    where: { id: adId, monitorId },
    include: { monitor: { select: { name: true } } },
  });
  if (!ad) notFound();

  const enriched = enrichAdMediaFromRaw({
    imageUrl: ad.imageUrl,
    videoUrl: ad.videoUrl,
    rawData: ad.rawData,
  });
  const mediaType =
    enriched.videoUrl && !(ad.mediaType ?? "").toUpperCase().includes("VIDEO")
      ? "VIDEO"
      : ad.mediaType;

  const daysRunning = computeDaysRunning(ad.deliveryStart, ad.deliveryStop, new Date());
  const winning = scoreAdWinning({
    daysRunning,
    isActive: ad.isActive,
    collationCount: ad.collationCount,
    audienceUpper: ad.audienceUpper,
    platformCount: ad.platforms.length,
  });

  const isDemo =
    !!ad.rawData &&
    typeof ad.rawData === "object" &&
    (ad.rawData as Record<string, unknown>)._demo === true;

  const data: AdDetailData = {
    monitorId,
    monitorName: ad.monitor.name,
    pageName: ad.pageName,
    pageProfileUrl: ad.pageProfileUrl,
    pageLikeCount: ad.pageLikeCount,
    pageCategories: ad.pageCategories,
    pageCreationDate: ad.pageCreationDate,
    totalActiveAds: ad.totalActiveAds,
    bodyText: ad.bodyText,
    linkTitle: ad.linkTitle,
    linkDescription: ad.linkDescription,
    linkCaption: ad.linkCaption,
    linkUrl: ad.linkUrl,
    ctaType: ad.ctaType,
    ctaText: ad.ctaText,
    mediaType,
    imageUrl: enriched.imageUrl,
    videoUrl: enriched.videoUrl,
    snapshotUrl: ad.snapshotUrl,
    platforms: ad.platforms,
    isActive: ad.isActive,
    deliveryStart: ad.deliveryStart?.toISOString() ?? null,
    deliveryStop: ad.deliveryStop?.toISOString() ?? null,
    daysRunning,
    collationCount: ad.collationCount,
    audienceLower: ad.audienceLower,
    audienceUpper: ad.audienceUpper,
    spendLower: ad.spendLower,
    spendUpper: ad.spendUpper,
    currency: ad.currency,
    cards: parseCards(ad.cards),
    winningScore: winning.score,
    winningTier: winning.tier,
    winningReasons: winning.reasons,
    isDemo,
  };

  return <BrandAdDetailClient data={data} />;
}
