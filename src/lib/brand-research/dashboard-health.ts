import "server-only";

import { isApifyConfigured } from "@/lib/apify/client";
import { isDataForSeoConfigured } from "@/lib/research/keyword-intel/dataforseo-keywords";
import { isInstagramMentionsConfigured } from "@/lib/research/social-listening/scrape-instagram-mentions";
import { isTikTokMentionsConfigured } from "@/lib/research/social-listening/scrape-tiktok-mentions";

export type DataHealthLevel = "live" | "partial" | "demo" | "idle";

export type BrandModuleHealth = {
  key: string;
  level: DataHealthLevel;
  detail: string;
};

export type BrandHubHealthInput = {
  reviewReady: number;
  reviewFailed: number;
  reviewTotal: number;
  socialReady: number;
  socialDemoBatch: boolean;
  trendReady: number;
  trendDemo: boolean;
  keywordReady: number;
  keywordTotal: number;
  competitorActive: number;
  competitorTotal: number;
  visualAssetCount: number;
  visualDemoAsset: boolean;
  uspReady: number;
  uspTotal: number;
  strategyReady: number;
  strategyTotal: number;
  creativeReady: number;
  creativeTotal: number;
  visualCollectionCount: number;
};

function reviewHealthLevel(opts: {
  configured: boolean;
  ready: number;
  failed: number;
}): DataHealthLevel {
  if (!opts.configured) return "demo";
  if (opts.ready === 0 && opts.failed === 0) return "idle";
  if (opts.failed > 0) return "partial";
  return "live";
}

export function buildBrandHubModuleHealth(
  input: BrandHubHealthInput,
): BrandModuleHealth[] {
  const apifyConfigured = isApifyConfigured();
  const shopeeReviewsConfigured =
    apifyConfigured && !!process.env.APIFY_ACTOR_SHOPEE_REVIEWS?.trim();
  const shopeeShopConfigured =
    apifyConfigured && !!process.env.APIFY_ACTOR_SHOPEE_SHOP?.trim();
  const socialConfigured =
    isTikTokMentionsConfigured() || isInstagramMentionsConfigured();
  const keywordsConfigured = isDataForSeoConfigured();

  return [
    {
      key: "brand-strategy",
      level:
        input.strategyReady === 0
          ? input.strategyTotal === 0
            ? "idle"
            : "partial"
          : "live",
      detail: `${input.strategyReady} dokumen siap / ${input.strategyTotal} total`,
    },
    {
      key: "creative-guideline",
      level:
        input.creativeReady === 0
          ? input.creativeTotal === 0
            ? "idle"
            : "partial"
          : "live",
      detail: `${input.creativeReady} guideline siap / ${input.creativeTotal} total`,
    },
    {
      key: "visual-library",
      level: !apifyConfigured
        ? "demo"
        : input.visualDemoAsset
          ? "demo"
          : input.visualAssetCount === 0
            ? "idle"
            : "live",
      detail: !apifyConfigured
        ? "APIFY_API_TOKEN tidak diset — Pinterest demo"
        : input.visualDemoAsset
          ? `${input.visualAssetCount} asset · sebagian demo`
          : `${input.visualAssetCount} asset visual`,
    },
    {
      key: "visual-trend",
      level: !apifyConfigured
        ? "demo"
        : input.visualCollectionCount === 0
          ? input.visualAssetCount === 0
            ? "idle"
            : "partial"
          : "live",
      detail: !apifyConfigured
        ? "Pinterest scrape belum dikonfigurasi"
        : `${input.visualCollectionCount} koleksi Pinterest · ${input.visualAssetCount} asset`,
    },
    {
      key: "research-review",
      level: reviewHealthLevel({
        configured: shopeeReviewsConfigured,
        ready: input.reviewReady,
        failed: input.reviewFailed,
      }),
      detail: shopeeReviewsConfigured
        ? `${input.reviewReady} siap / ${input.reviewTotal} sumber (Research Hub)`
        : "Scraper review belum dikonfigurasi",
    },
    {
      key: "social-listening",
      level: !socialConfigured
        ? "demo"
        : input.socialDemoBatch
          ? "demo"
          : input.socialReady === 0
            ? "idle"
            : "live",
      detail: !socialConfigured
        ? "Scraper IG/TikTok belum dikonfigurasi"
        : input.socialDemoBatch
          ? `${input.socialReady} batch · data demo terdeteksi`
          : `${input.socialReady} batch siap`,
    },
    {
      key: "research-trend",
      level: input.trendDemo
        ? "demo"
        : input.trendReady === 0
          ? "idle"
          : "live",
      detail: input.trendDemo
        ? `${input.trendReady} digest · narrative demo (Research Hub)`
        : `${input.trendReady} digest siap (Research Hub)`,
    },
    {
      key: "research-keyword",
      level:
        input.keywordReady === 0
          ? "idle"
          : !keywordsConfigured
            ? "demo"
            : "live",
      detail:
        input.keywordReady === 0
          ? "Belum ada query keyword"
          : keywordsConfigured
            ? `${input.keywordReady} query siap / ${input.keywordTotal} total`
            : "DataForSEO belum dikonfigurasi",
    },
    {
      key: "competitor-tracker",
      level: !shopeeShopConfigured
        ? "demo"
        : input.competitorActive === 0
          ? "idle"
          : "live",
      detail: shopeeShopConfigured
        ? `${input.competitorActive} aktif / ${input.competitorTotal} total (Research Hub)`
        : "Scraper toko belum dikonfigurasi",
    },
    {
      key: "research-usp",
      level: input.uspReady === 0 ? "idle" : "live",
      detail: `${input.uspReady} analisis siap / ${input.uspTotal} total (Research Hub)`,
    },
  ];
}
