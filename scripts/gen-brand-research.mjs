import fs from "fs";
import path from "path";

const pairs = [
  ["src/lib/research/competitor-diff.ts", "src/lib/brand-research/competitor-diff.ts"],
  ["src/lib/research/scrape-competitor.ts", "src/lib/brand-research/scrape-competitor.ts"],
  ["src/lib/research/run-apify-job.ts", "src/lib/brand-research/run-apify-job.ts"],
  ["src/lib/research/competitor-analyzer.ts", "src/lib/brand-research/competitor-analyzer.ts"],
  ["src/lib/research/scrape-review-source.ts", "src/lib/brand-research/scrape-review-source.ts"],
  ["src/lib/research/run-review-scrape-job.ts", "src/lib/brand-research/run-review-scrape-job.ts"],
  ["src/lib/research/review-analyzer.ts", "src/lib/brand-research/review-analyzer.ts"],
  ["src/lib/research/keyword-intel/keyword-analyzer.ts", "src/lib/brand-research/keyword-analyzer.ts"],
  ["src/lib/research/trend-radar/trend-analyzer.ts", "src/lib/brand-research/trend-analyzer.ts"],
  ["src/lib/research/social-listening/social-sync.ts", "src/lib/brand-research/social-sync.ts"],
  ["src/lib/research/usp-gap/usp-analyzer.ts", "src/lib/brand-research/usp-analyzer.ts"],
  ["src/lib/research/usp-gap/list-context-sources.ts", "src/lib/brand-research/list-context-sources.ts"],
  ["src/lib/research/usp-gap/gather-context.ts", "src/lib/brand-research/gather-context.ts"],
];

const replacements = [
  [/prisma\.researchCompetitor/g, "prisma.brandCompetitor"],
  [/prisma\.competitorSku/g, "prisma.brandCompetitorSku"],
  [/prisma\.competitorSnapshot/g, "prisma.brandCompetitorSnapshot"],
  [/prisma\.competitorAlert/g, "prisma.brandCompetitorAlert"],
  [/prisma\.researchScrapeJob/g, "prisma.brandResearchScrapeJob"],
  [/prisma\.reviewIntelSource/g, "prisma.brandReviewSource"],
  [/prisma\.reviewRaw/g, "prisma.brandReviewItem"],
  [/prisma\.reviewAnalysis/g, "prisma.brandReviewAnalysis"],
  [/prisma\.reviewIntelSummary/g, "prisma.brandReviewSummary"],
  [/prisma\.keywordIntelQuery/g, "prisma.brandKeywordQuery"],
  [/prisma\.keywordIntelResult/g, "prisma.brandKeywordResult"],
  [/prisma\.trendRadarDigest/g, "prisma.brandTrendDigest"],
  [/prisma\.trendRadarItem/g, "prisma.brandTrendSignal"],
  [/prisma\.socialListeningMonitor/g, "prisma.brandSocialMonitor"],
  [/prisma\.socialListeningBatch/g, "prisma.brandSocialBatch"],
  [/prisma\.socialMention/g, "prisma.brandSocialMention"],
  [/prisma\.socialListeningSummary/g, "prisma.brandSocialSummary"],
  [/prisma\.uspGapAnalysis/g, "prisma.brandUspAnalysis"],
  [/prisma\.uspGapResult/g, "prisma.brandUspResult"],
  [/@\/lib\/research\/competitor-diff/g, "@/lib/brand-research/competitor-diff"],
  [/@\/lib\/research\/run-apify-job/g, "@/lib/brand-research/run-apify-job"],
  [/@\/lib\/research\/scrape-competitor/g, "@/lib/brand-research/scrape-competitor"],
  [/@\/lib\/research\/competitor-analyzer/g, "@/lib/brand-research/competitor-analyzer"],
  [/@\/lib\/research\/scrape-review-source/g, "@/lib/brand-research/scrape-review-source"],
  [/@\/lib\/research\/run-review-scrape-job/g, "@/lib/brand-research/run-review-scrape-job"],
  [/@\/lib\/research\/review-analyzer/g, "@/lib/brand-research/review-analyzer"],
  [/@\/lib\/research\/usp-gap\/list-context-sources/g, "@/lib/brand-research/list-context-sources"],
  [/@\/lib\/research\/usp-gap\/gather-context/g, "@/lib/brand-research/gather-context"],
  [/\/research-hub\//g, "/brand-hub/"],
  [/module: "competitor-tracker"/g, 'module: "brand-competitor-tracker"'],
  [/module: "review-intelligence"/g, 'module: "brand-review-intelligence"'],
  [/module: "keyword-intel"/g, 'module: "brand-keyword-intel"'],
  [/module: "trend-radar"/g, 'module: "brand-trend-radar"'],
  [/module: "social-listening"/g, 'module: "brand-social-listening"'],
  [/module: "usp-analyzer"/g, 'module: "brand-usp-analyzer"'],
  [/export async function enqueueCompetitorScrape/g, "export async function enqueueBrandCompetitorScrape"],
  [/export async function enqueueReviewScrape/g, "export async function enqueueBrandReviewScrape"],
  [/export async function enqueueKeywordAnalysis/g, "export async function enqueueBrandKeywordAnalysis"],
  [/export async function analyzeKeywordQuery/g, "export async function analyzeBrandKeywordQuery"],
  [/export async function analyzeReviewSource/g, "export async function analyzeBrandReviewSource"],
  [/export async function analyzeCompetitor/g, "export async function analyzeBrandCompetitor"],
  [/export async function analyzeUspGap/g, "export async function analyzeBrandUspGap"],
  [/export async function generateTrendDigest/g, "export async function generateBrandTrendDigest"],
  [/export async function beginSocialListeningSync/g, "export async function beginBrandSocialListeningSync"],
  [/export async function finalizeSocialListeningBatch/g, "export async function finalizeBrandSocialListeningBatch"],
  [/export async function listUspContextSourceOptions/g, "export async function listBrandUspContextSourceOptions"],
  [/export async function suggestContextSourceIds/g, "export async function suggestBrandContextSourceIds"],
  [/export async function gatherUspContext/g, "export async function gatherBrandUspContext"],
  [/export async function runApifyJobToCompletion/g, "export async function runBrandApifyJobToCompletion"],
  [/export async function pollCompetitorScrapeJob/g, "export async function pollBrandCompetitorScrapeJob"],
  [/export async function pollReviewScrapeJob/g, "export async function pollBrandReviewScrapeJob"],
  [/export async function executeReviewScrapeJob/g, "export async function executeBrandReviewScrapeJob"],
  [/export async function resumeStuckResearchJobs/g, "export async function resumeStuckBrandJobs"],
  [/export async function resumeStuckReviewScrapeJobs/g, "export async function resumeStuckBrandReviewScrapeJobs"],
  [/export async function recoverMisclassifiedReviewScrapeJobs/g, "export async function recoverMisclassifiedBrandReviewScrapeJobs"],
  [/export async function pollReviewScrapeJobsLight/g, "export async function pollBrandReviewScrapeJobsLight"],
  [/export async function runDemoReviewScrape/g, "export async function runDemoBrandReviewScrape"],
  [/export async function completeReviewScrapeFromDataset/g, "export async function completeBrandReviewScrapeFromDataset"],
  [/export async function completeReviewScrapeFromNormalized/g, "export async function completeBrandReviewScrapeFromNormalized"],
  [/export async function ingestCompetitorProducts/g, "export async function ingestBrandCompetitorProducts"],
  [/async function runDemoCompetitorScrape/g, "async function runDemoBrandCompetitorScrape"],
  [/export async function applyCompetitorSnapshot/g, "export async function applyBrandCompetitorSnapshot"],
  [/export async function computeCompetitorExtraMetrics/g, "export async function computeBrandCompetitorExtraMetrics"],
];

for (const [src, dest] of pairs) {
  if (!fs.existsSync(src)) {
    console.log("SKIP missing", src);
    continue;
  }
  let content = fs.readFileSync(src, "utf8");
  for (const [re, rep] of replacements) content = content.replace(re, rep);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, content);
  console.log("Created", dest);
}
