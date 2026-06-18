import "server-only";

import { SocialListeningPlatform, SocialListeningStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
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
import { syncModuleRecommendations } from "@/lib/research/prescriptive/sync";
import type { ActionPlan } from "@/lib/research/prescriptive/types";
import type { RawSocialMention } from "@/lib/research/social-listening/collect-mentions";

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

/** Create batch, start Apify runs in parallel, persist platform state. */
export async function beginBrandSocialListeningSync(
  monitorId: string,
): Promise<{ batchId: string }> {
  const monitor = await prisma.brandSocialMonitor.findUnique({
    where: { id: monitorId },
  });
  if (!monitor) throw new Error("Monitor social listening tidak ditemukan.");

  const batch = await prisma.brandSocialBatch.create({
    data: {
      monitorId: monitor.id,
      status: SocialListeningStatus.COLLECTING,
    },
  });

  const { apifyRunIds, platformStatus, warnings } = await startPlatformScrapes({
    keywords: monitor.keywords,
    platforms: monitor.platforms,
  });

  await prisma.brandSocialBatch.update({
    where: { id: batch.id },
    data: {
      platformStatus,
      apifyRunIds,
      errorMessage: warnings.length > 0 ? warnings.join(" | ") : null,
    },
  });

  return { batchId: batch.id };
}

/** Poll until all platforms finish, then classify and mark READY. */
export async function finalizeBrandSocialListeningBatch(
  batchId: string,
): Promise<void> {
  const batch = await prisma.brandSocialBatch.findUnique({
    where: { id: batchId },
    include: { monitor: true },
  });
  if (!batch?.monitor) throw new Error("Batch social listening tidak ditemukan.");

  const monitor = batch.monitor;
  const apifyRunIds = parseJsonRecord(batch.apifyRunIds) as PlatformRunIds;
  const initialStatus = parseJsonRecord(
    batch.platformStatus,
  ) as PlatformStatusMap;

  let mentions: RawSocialMention[] = [];
  let platformStatus = initialStatus;
  let warnings = buildPlatformWarnings(
    monitor.platforms,
    platformStatus,
    apifyRunIds,
  );

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

    await prisma.brandSocialBatch.update({
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
    mentions = generateDemoMentions(monitor.keywords, monitor.platforms);
    usedDemo = true;
    warnings.push(
      "Menggunakan data demo karena scrape kosong atau API tidak tersedia.",
    );
  }

  if (warnings.length > 0) {
    console.warn("[social-sync] warnings:", warnings.join(" | "));
  }

  try {
    await prisma.brandSocialBatch.update({
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

    let actionPlan: ActionPlan | null = null;
    let aiMeta = classifyMeta ?? researchAiMetaFromSteps([]);
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
        actionPlan = coerceActionPlan(planResult.actionPlan, `social-${batchId}`);
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

    await prisma.$transaction([
      prisma.brandSocialMention.createMany({
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
        })),
        skipDuplicates: true,
      }),
      prisma.brandSocialSummary.upsert({
        where: { batchId },
        create: {
          batchId,
          topPainPoints: summary.topPainPoints,
          topWishlist: summary.topWishlist,
          influencers: summary.influencers,
          viralContent: summary.viralContent,
          categoryBreakdown: summary.categoryBreakdown,
          sentimentTimeline: summary.sentimentTimeline,
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
          aiActionPlan: actionPlan ?? undefined,
          aiSummary: aiSummaryText,
          aiMeta: aiMeta.steps.length > 0 ? (aiMeta as object) : undefined,
        },
      }),
      prisma.brandSocialBatch.update({
        where: { id: batchId },
        data: {
          status: SocialListeningStatus.READY,
          collectedAt: new Date(),
          platformStatus,
          errorMessage: warnings.length > 0 ? warnings.join(" | ") : null,
        },
      }),
    ]);

    await syncModuleRecommendations({
      module: "brand-social-listening",
      sourceId: monitor.id,
      sourceLabel: `Social: ${monitor.name}`,
      href: `/brand-hub/social-listening/${monitor.id}`,
      plan: actionPlan,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync gagal";
    await prisma.brandSocialBatch.update({
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
  const { batchId } = await beginBrandSocialListeningSync(monitorId);
  await finalizeBrandSocialListeningBatch(batchId);
  return { batchId };
}

export async function syncActiveMonitors(): Promise<{ synced: number }> {
  const monitors = await prisma.brandSocialMonitor.findMany({
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
