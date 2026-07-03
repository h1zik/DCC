import "server-only";

import { revalidatePath } from "next/cache";
import {
  ScrapeDataProvenance,
  SocialListeningPlatform,
  SocialListeningStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isDemoDataAllowed } from "@/lib/demo-data-policy";
import { PLATFORM_STATUS_PROVIDERS_KEY } from "@/lib/research/scrape-data-provider";
import { generateResearchJson } from "@/lib/research/gemini-client";
import {
  buildResearchAiStep,
  mergeResearchAiMeta,
  researchAiMetaFromSteps,
} from "@/lib/research/llm";
import { aggregateSocialSummary } from "@/lib/research/social-listening/aggregate-summary";
import { generateDemoMentions } from "@/lib/research/social-listening/demo-mentions";
import { classifyMentions } from "@/lib/research/social-listening/mention-analyzer";
import {
  platformStatusMessage,
  startPlatformScrapes,
  waitForPlatformScrapes,
  type PlatformRunIds,
  type PlatformStatusMap,
} from "@/lib/research/social-listening/platform-scrape-runner";
import { buildSocialActionPlanPrompt } from "@/lib/research/social-listening/prompts/mention-analysis";
import { coerceActionPlan } from "@/lib/research/prescriptive/parse";
import {
  corpusFromData,
  groundActionPlan,
} from "@/lib/research/usp-gap/evidence-grounding";
import { syncModuleRecommendations } from "@/lib/research/prescriptive/sync";
import type { ActionPlan } from "@/lib/research/prescriptive/types";
import type { RawSocialMention } from "@/lib/research/social-listening/collect-mentions";
import { resolveSearchLimits } from "@/lib/research/social-listening/search-limits";

function parseJsonRecord(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as Record<string, unknown>;
}

function countByPlatform(
  mentions: RawSocialMention[],
): Partial<Record<SocialListeningPlatform, number>> {
  const counts: Partial<Record<SocialListeningPlatform, number>> = {};
  for (const m of mentions) {
    counts[m.platform] = (counts[m.platform] ?? 0) + 1;
  }
  return counts;
}

function buildPlatformWarnings(
  platforms: SocialListeningPlatform[],
  platformStatus: PlatformStatusMap,
  apifyRunIds: PlatformRunIds,
): string[] {
  return platforms
    .map((p) => {
      const status = platformStatus[p];
      if (!status || status === "READY") return null;
      return platformStatusMessage(p, status, apifyRunIds[p]);
    })
    .filter((w): w is string => !!w);
}

function isScrapePendingStart(
  platformStatus: PlatformStatusMap,
  platforms: SocialListeningPlatform[],
): boolean {
  return platforms.every((p) => platformStatus[p] == null);
}

/** Buat batch saja — scrape berat dijalankan di background (finalize). */
export async function beginSocialListeningSync(
  monitorId: string,
): Promise<{ batchId: string }> {
  const monitor = await prisma.socialListeningMonitor.findUnique({
    where: { id: monitorId },
  });
  if (!monitor) throw new Error("Monitor social listening tidak ditemukan.");

  const batch = await prisma.socialListeningBatch.create({
    data: {
      monitorId: monitor.id,
      status: SocialListeningStatus.COLLECTING,
    },
  });

  return { batchId: batch.id };
}

async function kickoffPlatformScrapesForBatch(
  batchId: string,
  monitor: {
    keywords: string[];
    platforms: SocialListeningPlatform[];
    tiktokSearchLimit: number;
    instagramSearchLimit: number;
  },
): Promise<{
  apifyRunIds: PlatformRunIds;
  platformStatus: PlatformStatusMap;
  warnings: string[];
}> {
  const searchLimits = resolveSearchLimits(monitor);
  const started = await startPlatformScrapes({
    keywords: monitor.keywords,
    platforms: monitor.platforms,
    searchLimits,
  });

  await prisma.socialListeningBatch.update({
    where: { id: batchId },
    data: {
      platformStatus: started.platformStatus,
      apifyRunIds: started.apifyRunIds,
      errorMessage:
        started.warnings.length > 0 ? started.warnings.join(" | ") : null,
    },
  });

  return started;
}

/** Poll until all platforms finish, then classify and mark READY. */
export async function finalizeSocialListeningBatch(
  batchId: string,
): Promise<void> {
  const batch = await prisma.socialListeningBatch.findUnique({
    where: { id: batchId },
    include: { monitor: true },
  });
  if (!batch?.monitor) throw new Error("Batch social listening tidak ditemukan.");

  const monitor = batch.monitor;
  let apifyRunIds = parseJsonRecord(batch.apifyRunIds) as PlatformRunIds;
  let platformStatus = parseJsonRecord(
    batch.platformStatus,
  ) as PlatformStatusMap;
  let scrapeWarnings: string[] = [];

  if (isScrapePendingStart(platformStatus, monitor.platforms)) {
    const started = await kickoffPlatformScrapesForBatch(batchId, monitor);
    apifyRunIds = started.apifyRunIds;
    platformStatus = started.platformStatus;
    scrapeWarnings = started.warnings;
  }

  let mentions: RawSocialMention[] = [];
  let warnings = [
    ...scrapeWarnings,
    ...buildPlatformWarnings(monitor.platforms, platformStatus, apifyRunIds),
  ];

  const hasCollecting = monitor.platforms.some(
    (p) => platformStatus[p] === "COLLECTING",
  );

  if (hasCollecting) {
    const pollResult = await waitForPlatformScrapes({
      platforms: monitor.platforms,
      apifyRunIds,
      platformStatus,
      pollIntervalMs: 10_000,
      maxWaitMs: 1_800_000,
    });
    platformStatus = pollResult.platformStatus;
    mentions = pollResult.mentions;
    warnings = [
      ...buildPlatformWarnings(monitor.platforms, platformStatus, apifyRunIds),
      ...pollResult.warnings,
    ];

    await prisma.socialListeningBatch.update({
      where: { id: batchId },
      data: { platformStatus, errorMessage: warnings.join(" | ") || null },
    });
  }

  const platformCounts = countByPlatform(mentions);
  const countSummary = Object.entries(platformCounts)
    .map(([p, n]) => `${p}: ${n}`)
    .join(", ");
  if (countSummary) {
    warnings.unshift(`Mention terkumpul — ${countSummary}`);
  }

  let usedDemo = false;
  if (mentions.length === 0) {
    if (!isDemoDataAllowed()) {
      // Fail-loud: jangan fabrikasi mention. Batch ditandai FAILED dengan
      // penjelasan, bukan READY berisi data palsu.
      await prisma.socialListeningBatch.update({
        where: { id: batchId },
        data: {
          status: SocialListeningStatus.FAILED,
          platformStatus,
          errorMessage: [
            "Scrape menghasilkan 0 mention dan data demo dinonaktifkan di produksi.",
            ...warnings,
          ].join(" | "),
        },
      });
      return;
    }
    mentions = generateDemoMentions(monitor.keywords, monitor.platforms);
    usedDemo = true;
    warnings.push(
      "Menggunakan data demo karena scrape kosong atau API tidak tersedia.",
    );
    platformStatus = {
      ...platformStatus,
      [PLATFORM_STATUS_PROVIDERS_KEY]: Object.fromEntries(
        monitor.platforms.map((p) => [p, "demo"]),
      ),
    } as PlatformStatusMap;
  }

  if (warnings.length > 0) {
    console.warn("[social-sync] warnings:", warnings.join(" | "));
  }

  try {
    await prisma.socialListeningBatch.update({
      where: { id: batchId },
      data: { status: SocialListeningStatus.ANALYZING },
    });

    const { classified, aiSummary, aiMeta: classifyMeta } =
      await classifyMentions({
      monitorName: monitor.name,
      keywords: monitor.keywords,
      mentions,
    });

    const summary = aggregateSocialSummary(classified);
    let aiMeta = classifyMeta ?? researchAiMetaFromSteps([]);

    let actionPlan: ActionPlan | null = null;
    if (summary.topPainPoints.length > 0 || summary.topWishlist.length > 0) {
      try {
        const planResult = await generateResearchJson<{ actionPlan?: unknown }>(
          buildSocialActionPlanPrompt({
            monitorName: monitor.name,
            painPoints: summary.topPainPoints,
            wishlist: summary.topWishlist,
            categoryBreakdown: summary.categoryBreakdown,
          }),
          { tier: "pro" },
        );
        actionPlan = groundActionPlan(
          coerceActionPlan(planResult.actionPlan, `social-${batchId}`),
          corpusFromData({
            painPoints: summary.topPainPoints,
            wishlist: summary.topWishlist,
            categoryBreakdown: summary.categoryBreakdown,
          }),
        );
        aiMeta = mergeResearchAiMeta(
          aiMeta,
          buildResearchAiStep("Rencana aksi sosial", "pro"),
        );
      } catch (err) {
        console.error("[social-sync] action plan gagal", err);
      }
    }

    const summaryNote = usedDemo ? " (data demo)" : "";
    const aiSummaryText =
      warnings.length > 0
        ? `${aiSummary}${summaryNote} (${warnings.join(" ")})`
        : `${aiSummary}${summaryNote}`;

    await prisma.$transaction(async (tx) => {
      await tx.socialMention.createMany({
        data: classified.map((m) => ({
          batchId,
          platform: m.platform,
          externalId: m.externalId,
          text: m.text,
          author: m.author ?? null,
          url: m.url ?? null,
          likes: m.likes,
          comments: m.comments,
          views: m.views,
          classification: m.classification,
          painPoint: m.painPoint,
          isViral: m.isViral,
          postedAt: m.postedAt ?? null,
          thumbnailUrl: m.thumbnailUrl ?? null,
          mediaType: m.mediaType ?? null,
        })),
        skipDuplicates: true,
      });

      await tx.socialListeningSummary.upsert({
        where: { batchId },
        create: {
          batchId,
          topPainPoints: summary.topPainPoints,
          topWishlist: summary.topWishlist,
          influencers: summary.influencers,
          viralContent: summary.viralContent,
          categoryBreakdown: summary.categoryBreakdown,
          sentimentTimeline: summary.sentimentTimeline,
          engagementInsights: summary.engagementInsights,
          aiActionPlan: actionPlan ?? undefined,
          aiSummary: aiSummaryText,
          aiMeta: aiMeta.steps.length > 0 ? (aiMeta as object) : undefined,
        },
        update: {
          topPainPoints: summary.topPainPoints,
          topWishlist: summary.topWishlist,
          influencers: summary.influencers,
          viralContent: summary.viralContent,
          categoryBreakdown: summary.categoryBreakdown,
          sentimentTimeline: summary.sentimentTimeline,
          engagementInsights: summary.engagementInsights,
          aiActionPlan: actionPlan ?? undefined,
          aiSummary: aiSummaryText,
          aiMeta: aiMeta.steps.length > 0 ? (aiMeta as object) : undefined,
        },
      });

      await tx.socialListeningBatch.update({
        where: { id: batchId },
        data: {
          status: SocialListeningStatus.READY,
          collectedAt: new Date(),
          platformStatus,
          dataProvenance: usedDemo ? ScrapeDataProvenance.DEMO : undefined,
          errorMessage: warnings.length > 0 ? warnings.join(" | ") : null,
        },
      });
    });

    await syncModuleRecommendations({
      module: "social-listening",
      sourceId: monitor.id,
      sourceLabel: `Social: ${monitor.name}`,
      href: `/research-hub/social-listening/${monitor.id}`,
      plan: actionPlan,
    });

    revalidatePath("/research-hub/social-listening");
    revalidatePath(`/research-hub/social-listening/${monitor.id}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync gagal";
    await prisma.socialListeningBatch.update({
      where: { id: batchId },
      data: {
        status: SocialListeningStatus.FAILED,
        errorMessage: message,
        platformStatus,
      },
    });
    throw err;
  }
}

export async function syncSocialListeningMonitor(
  monitorId: string,
): Promise<{ batchId: string }> {
  const { batchId } = await beginSocialListeningSync(monitorId);
  await finalizeSocialListeningBatch(batchId);
  return { batchId };
}

export async function syncActiveMonitors(): Promise<{ synced: number }> {
  const monitors = await prisma.socialListeningMonitor.findMany({
    where: { isActive: true },
  });

  let synced = 0;
  for (const monitor of monitors) {
    try {
      await syncSocialListeningMonitor(monitor.id);
      synced += 1;
    } catch (err) {
      console.error("[social-sync] monitor gagal", monitor.id, err);
    }
  }

  return { synced };
}
