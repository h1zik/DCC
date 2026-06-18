import fs from "fs";
import path from "path";

const actionPairs = [
  ["src/actions/research-competitor.ts", "src/actions/brand-competitor.ts"],
  ["src/actions/research-review-intelligence.ts", "src/actions/brand-review-intelligence.ts"],
  ["src/actions/research-keyword-intel.ts", "src/actions/brand-keyword-intel.ts"],
  ["src/actions/research-trend-radar.ts", "src/actions/brand-trend-radar.ts"],
  ["src/actions/research-social-listening.ts", "src/actions/brand-social-listening.ts"],
  ["src/actions/research-usp-gap.ts", "src/actions/brand-usp-gap.ts"],
];

const uiPairs = [
  [
    "src/app/(dashboard)/research-hub/competitor-tracker/competitor-tracker-client.tsx",
    "src/app/(dashboard)/brand-hub/competitor-tracker/brand-competitor-tracker-client.tsx",
  ],
  [
    "src/app/(dashboard)/research-hub/competitor-tracker/[competitorId]/page.tsx",
    "src/app/(dashboard)/brand-hub/competitor-tracker/[competitorId]/page.tsx",
  ],
  [
    "src/app/(dashboard)/research-hub/competitor-tracker/[competitorId]/competitor-detail-client.tsx",
    "src/app/(dashboard)/brand-hub/competitor-tracker/[competitorId]/brand-competitor-detail-client.tsx",
  ],
  [
    "src/app/(dashboard)/research-hub/review-intelligence/review-intelligence-client.tsx",
    "src/app/(dashboard)/brand-hub/review-intelligence/brand-review-intel-client.tsx",
  ],
  [
    "src/app/(dashboard)/research-hub/review-intelligence/[sourceId]/page.tsx",
    "src/app/(dashboard)/brand-hub/review-intelligence/[sourceId]/page.tsx",
  ],
  [
    "src/app/(dashboard)/research-hub/review-intelligence/[sourceId]/review-detail-client.tsx",
    "src/app/(dashboard)/brand-hub/review-intelligence/[sourceId]/brand-review-detail-client.tsx",
  ],
  [
    "src/app/(dashboard)/research-hub/trend-radar/trend-radar-client.tsx",
    "src/app/(dashboard)/brand-hub/trend-radar/brand-trend-radar-client.tsx",
  ],
  [
    "src/app/(dashboard)/research-hub/trend-radar/[digestId]/page.tsx",
    "src/app/(dashboard)/brand-hub/trend-radar/[digestId]/page.tsx",
  ],
  [
    "src/app/(dashboard)/research-hub/trend-radar/[digestId]/trend-detail-client.tsx",
    "src/app/(dashboard)/brand-hub/trend-radar/[digestId]/brand-trend-detail-client.tsx",
  ],
  [
    "src/app/(dashboard)/research-hub/keyword-intel/keyword-intel-client.tsx",
    "src/app/(dashboard)/brand-hub/keyword-intel/brand-keyword-intel-client.tsx",
  ],
  [
    "src/app/(dashboard)/research-hub/keyword-intel/[queryId]/page.tsx",
    "src/app/(dashboard)/brand-hub/keyword-intel/[queryId]/page.tsx",
  ],
  [
    "src/app/(dashboard)/research-hub/keyword-intel/[queryId]/keyword-detail-client.tsx",
    "src/app/(dashboard)/brand-hub/keyword-intel/[queryId]/brand-keyword-detail-client.tsx",
  ],
  [
    "src/app/(dashboard)/research-hub/social-listening/social-listening-client.tsx",
    "src/app/(dashboard)/brand-hub/social-listening/brand-social-listening-client.tsx",
  ],
  [
    "src/app/(dashboard)/research-hub/social-listening/[monitorId]/page.tsx",
    "src/app/(dashboard)/brand-hub/social-listening/[monitorId]/page.tsx",
  ],
  [
    "src/app/(dashboard)/research-hub/social-listening/[monitorId]/social-detail-client.tsx",
    "src/app/(dashboard)/brand-hub/social-listening/[monitorId]/brand-social-detail-client.tsx",
  ],
  [
    "src/app/(dashboard)/research-hub/usp-analyzer/usp-analyzer-client.tsx",
    "src/app/(dashboard)/brand-hub/usp-analyzer/brand-usp-analyzer-client.tsx",
  ],
  [
    "src/app/(dashboard)/research-hub/usp-analyzer/[analysisId]/page.tsx",
    "src/app/(dashboard)/brand-hub/usp-analyzer/[analysisId]/page.tsx",
  ],
  [
    "src/app/(dashboard)/research-hub/usp-analyzer/[analysisId]/usp-detail-client.tsx",
    "src/app/(dashboard)/brand-hub/usp-analyzer/[analysisId]/brand-usp-detail-client.tsx",
  ],
  [
    "src/app/(dashboard)/research-hub/use-research-job-progress.ts",
    "src/app/(dashboard)/brand-hub/use-brand-job-progress.ts",
  ],
  [
    "src/app/(dashboard)/research-hub/review-intelligence/use-review-intel-polling.ts",
    "src/app/(dashboard)/brand-hub/review-intelligence/use-brand-review-intel-polling.ts",
  ],
];

const replacements = [
  [/requireMarketAnalyst/g, "requireBrandManager"],
  [/@\/lib\/research\/auth/g, "@/lib/brand-research/auth"],
  [/@\/actions\/research-competitor/g, "@/actions/brand-competitor"],
  [/@\/actions\/research-review-intelligence/g, "@/actions/brand-review-intelligence"],
  [/@\/actions\/research-keyword-intel/g, "@/actions/brand-keyword-intel"],
  [/@\/actions\/research-trend-radar/g, "@/actions/brand-trend-radar"],
  [/@\/actions\/research-social-listening/g, "@/actions/brand-social-listening"],
  [/@\/actions\/research-usp-gap/g, "@/actions/brand-usp-gap"],
  [/@\/lib\/research\/scrape-competitor/g, "@/lib/brand-research/scrape-competitor"],
  [/@\/lib\/research\/scrape-review-source/g, "@/lib/brand-research/scrape-review-source"],
  [/@\/lib\/research\/run-apify-job/g, "@/lib/brand-research/run-apify-job"],
  [/@\/lib\/research\/run-review-scrape-job/g, "@/lib/brand-research/run-review-scrape-job"],
  [/@\/lib\/research\/keyword-intel\/keyword-analyzer/g, "@/lib/brand-research/keyword-analyzer"],
  [/@\/lib\/research\/trend-radar\/trend-analyzer/g, "@/lib/brand-research/trend-analyzer"],
  [/@\/lib\/research\/social-listening\/social-sync/g, "@/lib/brand-research/social-sync"],
  [/@\/lib\/research\/usp-gap\/usp-analyzer/g, "@/lib/brand-research/usp-analyzer"],
  [/@\/lib\/research\/usp-gap\/list-context-sources/g, "@/lib/brand-research/list-context-sources"],
  [/enqueueCompetitorScrape/g, "enqueueBrandCompetitorScrape"],
  [/enqueueReviewScrape/g, "enqueueBrandReviewScrape"],
  [/enqueueKeywordAnalysis/g, "enqueueBrandKeywordAnalysis"],
  [/generateTrendDigest/g, "generateBrandTrendDigest"],
  [/beginSocialListeningSync/g, "beginBrandSocialListeningSync"],
  [/finalizeSocialListeningBatch/g, "finalizeBrandSocialListeningBatch"],
  [/analyzeUspGap/g, "analyzeBrandUspGap"],
  [/listUspContextSourceOptions/g, "listBrandUspContextSourceOptions"],
  [/suggestContextSourceIds/g, "suggestBrandContextSourceIds"],
  [/resumeStuckResearchJobs/g, "resumeStuckBrandJobs"],
  [/pollReviewIntelJobs/g, "pollBrandReviewIntelJobs"],
  [/pollReviewScrapeJobsLight/g, "pollBrandReviewScrapeJobsLight"],
  [/createResearchCompetitor/g, "createBrandCompetitor"],
  [/refreshResearchCompetitor/g, "refreshBrandCompetitor"],
  [/toggleResearchCompetitorActive/g, "toggleBrandCompetitorActive"],
  [/deleteResearchCompetitor/g, "deleteBrandCompetitor"],
  [/createReviewIntelSource/g, "createBrandReviewIntelSource"],
  [/rescrapeReviewIntelSource/g, "rescrapeBrandReviewIntelSource"],
  [/deleteReviewIntelSource/g, "deleteBrandReviewIntelSource"],
  [/listReviewIntelSourcesForCompare/g, "listBrandReviewIntelSourcesForCompare"],
  [/createKeywordIntelQuery/g, "createBrandKeywordIntelQuery"],
  [/refreshKeywordIntelQuery/g, "refreshBrandKeywordIntelQuery"],
  [/deleteKeywordIntelQuery/g, "deleteBrandKeywordIntelQuery"],
  [/createSocialListeningMonitor/g, "createBrandSocialListeningMonitor"],
  [/refreshSocialListeningMonitor/g, "refreshBrandSocialListeningMonitor"],
  [/toggleSocialListeningMonitorActive/g, "toggleBrandSocialListeningMonitorActive"],
  [/deleteSocialListeningMonitor/g, "deleteBrandSocialListeningMonitor"],
  [/createUspGapAnalysis/g, "createBrandUspGapAnalysis"],
  [/refreshUspGapAnalysis/g, "refreshBrandUspGapAnalysis"],
  [/deleteUspGapAnalysis/g, "deleteBrandUspGapAnalysis"],
  [/getUspContextSourceOptions/g, "getBrandUspContextSourceOptions"],
  [/suggestUspContextSources/g, "suggestBrandUspContextSources"],
  [/prisma\.researchCompetitor/g, "prisma.brandCompetitor"],
  [/prisma\.researchScrapeJob/g, "prisma.brandResearchScrapeJob"],
  [/prisma\.reviewIntelSource/g, "prisma.brandReviewSource"],
  [/prisma\.keywordIntelQuery/g, "prisma.brandKeywordQuery"],
  [/prisma\.keywordIntelResult/g, "prisma.brandKeywordResult"],
  [/prisma\.trendRadarDigest/g, "prisma.brandTrendDigest"],
  [/prisma\.trendWatchlist/g, "prisma.brandTrendDigest"],
  [/prisma\.trendRadarUserSettings/g, "prisma.brandTrendDigest"],
  [/prisma\.socialListeningMonitor/g, "prisma.brandSocialMonitor"],
  [/prisma\.uspGapAnalysis/g, "prisma.brandUspAnalysis"],
  [/prisma\.competitorAlert/g, "prisma.brandCompetitorAlert"],
  [/prisma\.competitorSku/g, "prisma.brandCompetitorSku"],
  [/prisma\.competitorSnapshot/g, "prisma.brandCompetitorSnapshot"],
  [/prisma\.reviewRaw/g, "prisma.brandReviewItem"],
  [/prisma\.socialListeningBatch/g, "prisma.brandSocialBatch"],
  [/prisma\.socialMention/g, "prisma.brandSocialMention"],
  [/prisma\.socialListeningSummary/g, "prisma.brandSocialSummary"],
  [/prisma\.trendRadarItem/g, "prisma.brandTrendSignal"],
  [/prisma\.uspGapResult/g, "prisma.brandUspResult"],
  [/brandId/g, "ownerBrandId"],
  [/\/research-hub\//g, "/brand-hub/"],
  [/CompetitorTrackerClient/g, "BrandCompetitorTrackerClient"],
  [/CompetitorDetailClient/g, "BrandCompetitorDetailClient"],
  [/ReviewIntelligenceClient/g, "BrandReviewIntelClient"],
  [/ReviewDetailClient/g, "BrandReviewDetailClient"],
  [/TrendRadarClient/g, "BrandTrendRadarClient"],
  [/TrendDetailClient/g, "BrandTrendDetailClient"],
  [/KeywordIntelClient/g, "BrandKeywordIntelClient"],
  [/KeywordDetailClient/g, "BrandKeywordDetailClient"],
  [/SocialListeningClient/g, "BrandSocialListeningClient"],
  [/SocialDetailClient/g, "BrandSocialDetailClient"],
  [/UspAnalyzerClient/g, "BrandUspAnalyzerClient"],
  [/UspDetailClient/g, "BrandUspDetailClient"],
  [/useResearchJobProgress/g, "useBrandJobProgress"],
  [/useReviewIntelPolling/g, "useBrandReviewIntelPolling"],
  [/from "\.\.\/\.\.\/use-research-job-progress"/g, 'from "../../use-brand-job-progress"'],
  [/from "\.\/use-review-intel-polling"/g, 'from "./use-brand-review-intel-polling"'],
  [/from "\.\/competitor-detail-client"/g, 'from "./brand-competitor-detail-client"'],
  [/from "\.\/review-detail-client"/g, 'from "./brand-review-detail-client"'],
  [/from "\.\/trend-detail-client"/g, 'from "./brand-trend-detail-client"'],
  [/from "\.\/keyword-detail-client"/g, 'from "./brand-keyword-detail-client"'],
  [/from "\.\/social-detail-client"/g, 'from "./brand-social-detail-client"'],
  [/from "\.\/usp-detail-client"/g, 'from "./brand-usp-detail-client"'],
  [/from "\.\/competitor-tracker-client"/g, 'from "./brand-competitor-tracker-client"'],
  [/from "\.\/review-intelligence-client"/g, 'from "./brand-review-intel-client"'],
  [/from "\.\/trend-radar-client"/g, 'from "./brand-trend-radar-client"'],
  [/from "\.\/keyword-intel-client"/g, 'from "./brand-keyword-intel-client"'],
  [/from "\.\/social-listening-client"/g, 'from "./brand-social-listening-client"'],
  [/from "\.\/usp-analyzer-client"/g, 'from "./brand-usp-analyzer-client"'],
];

function transform(content, isAction) {
  let out = content;
  for (const [re, rep] of replacements) out = out.replace(re, rep);
  if (isAction) {
    out = out.replace(/createTrendWatchlist/g, "createBrandTrendDigest");
    out = out.replace(/updateTrendWatchlist/g, "updateBrandTrendDigest");
    out = out.replace(/deleteTrendWatchlist/g, "deleteBrandTrendDigest");
    out = out.replace(/refreshTrendWatchlist/g, "refreshBrandTrendDigest");
    out = out.replace(/refreshGlobalTrendDigest/g, "refreshGlobalBrandTrendDigest");
  }
  return out;
}

for (const [src, dest] of actionPairs) {
  if (!fs.existsSync(src)) continue;
  const content = transform(fs.readFileSync(src, "utf8"), true);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, content);
  console.log("Action", dest);
}

for (const [src, dest] of uiPairs) {
  if (!fs.existsSync(src)) continue;
  const content = transform(fs.readFileSync(src, "utf8"), false);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, content);
  console.log("UI", dest);
}
