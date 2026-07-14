import { notFound } from "next/navigation";
import { ensureBrandHubPage } from "../../layout";
import { enrichAdMediaFromRaw } from "@/lib/apify/normalize-meta-ads";
import { filterAdsForMonitorView } from "@/lib/brand-research/ad-library-safety";
import { getBrandAdLibraryMonitorDetail } from "@/lib/brand-research/scrape-meta-ads";
import {
  BrandAdLibraryDetailClient,
  type AdLibraryAiInsights,
  type AdLibraryDetailData,
} from "./brand-ad-library-detail-client";

function parseAiInsights(raw: unknown): AdLibraryAiInsights | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  return {
    dominantFormats: Array.isArray(o.dominantFormats)
      ? o.dominantFormats.filter((x): x is string => typeof x === "string")
      : undefined,
    dominantCtas: Array.isArray(o.dominantCtas)
      ? o.dominantCtas.filter((x): x is string => typeof x === "string")
      : undefined,
    hookPatterns: Array.isArray(o.hookPatterns)
      ? o.hookPatterns.filter((x): x is string => typeof x === "string")
      : undefined,
    creativeRecommendations: Array.isArray(o.creativeRecommendations)
      ? o.creativeRecommendations.filter((x): x is string => typeof x === "string")
      : undefined,
  };
}

export default async function BrandAdLibraryDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ monitorId: string }>;
  searchParams: Promise<{ brandId?: string }>;
}) {
  await ensureBrandHubPage();
  const { monitorId } = await params;
  const { brandId } = await searchParams;

  const monitor = await getBrandAdLibraryMonitorDetail(monitorId, brandId ?? null);
  if (!monitor) notFound();

  const latestBatch = monitor.batches[0];
  const rawAds = monitor.ads.map((ad) => {
    const enriched = enrichAdMediaFromRaw({
      imageUrl: ad.imageUrl,
      videoUrl: ad.videoUrl,
      rawData: ad.rawData,
    });
    return {
      id: ad.id,
      externalId: ad.externalId,
      pageName: ad.pageName,
      bodyText: ad.bodyText,
      linkTitle: ad.linkTitle,
      ctaType: ad.ctaType,
      ctaText: ad.ctaText,
      mediaType:
        enriched.videoUrl && !(ad.mediaType ?? "").toUpperCase().includes("VIDEO")
          ? "VIDEO"
          : ad.mediaType,
      imageUrl: enriched.imageUrl,
      videoUrl: enriched.videoUrl,
      snapshotUrl: ad.snapshotUrl,
      linkUrl: ad.linkUrl,
      platforms: ad.platforms,
      isActive: ad.isActive,
      deliveryStart: ad.deliveryStart?.toISOString() ?? null,
      deliveryStop: ad.deliveryStop?.toISOString() ?? null,
      winningScore: ad.winningScore,
      collationCount: ad.collationCount,
      rawData:
        ad.rawData && typeof ad.rawData === "object"
          ? (ad.rawData as Record<string, unknown>)
          : null,
    };
  });

  const filteredAds = filterAdsForMonitorView(rawAds, {
    searchTerms: monitor.searchTerms,
    adLibraryUrls: monitor.adLibraryUrls,
    searchType: monitor.searchType,
  });

  // Demo ads carry `_demo: true` in rawData. Detect before stripping rawData so the
  // UI can disclose fabricated data instead of presenting it as real scraped ads.
  const isDemo = filteredAds.some(
    (ad) => ad.rawData && (ad.rawData as Record<string, unknown>)._demo === true,
  );

  const ads = filteredAds.map(({ rawData: _raw, ...ad }) => ad);

  const harvestableImageCount = ads.filter(
    (ad) => ad.imageUrl || ad.snapshotUrl,
  ).length;

  const data: AdLibraryDetailData = {
    id: monitor.id,
    name: monitor.name,
    searchTerms: monitor.searchTerms,
    adLibraryUrls: monitor.adLibraryUrls,
    country: monitor.country,
    mediaType: monitor.mediaType,
    batchStatus: latestBatch?.status ?? null,
    errorMessage: latestBatch?.errorMessage ?? null,
    collectedAt: latestBatch?.collectedAt?.toISOString() ?? null,
    aiSummary: monitor.aiSummary,
    aiInsights: parseAiInsights(monitor.aiInsights),
    harvestableImageCount,
    ads,
    isDemo,
  };

  return <BrandAdLibraryDetailClient data={data} />;
}
