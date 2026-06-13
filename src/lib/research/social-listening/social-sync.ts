import "server-only";

import { SocialListeningStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { aggregateSocialSummary } from "@/lib/research/social-listening/aggregate-summary";
import { collectMentions } from "@/lib/research/social-listening/collect-mentions";
import { classifyMentions } from "@/lib/research/social-listening/mention-analyzer";

export async function syncSocialListeningMonitor(
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

  try {
    const { mentions, warnings, platformCounts } = await collectMentions({
      keywords: monitor.keywords,
      platforms: monitor.platforms,
    });

    const countSummary = Object.entries(platformCounts)
      .map(([p, n]) => `${p}: ${n}`)
      .join(", ");
    if (countSummary) {
      warnings.unshift(`Mention terkumpul — ${countSummary}`);
    }

    if (warnings.length > 0) {
      console.warn("[social-sync] warnings:", warnings.join(" | "));
    }

    await prisma.socialListeningBatch.update({
      where: { id: batch.id },
      data: { status: SocialListeningStatus.ANALYZING },
    });

    const { classified, aiSummary } = await classifyMentions({
      monitorName: monitor.name,
      keywords: monitor.keywords,
      mentions,
    });

    const summary = aggregateSocialSummary(classified);

    await prisma.$transaction([
      prisma.socialMention.createMany({
        data: classified.map((m) => ({
          batchId: batch.id,
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
      prisma.socialListeningSummary.upsert({
        where: { batchId: batch.id },
        create: {
          batchId: batch.id,
          topPainPoints: summary.topPainPoints,
          topWishlist: summary.topWishlist,
          influencers: summary.influencers,
          viralContent: summary.viralContent,
          categoryBreakdown: summary.categoryBreakdown,
          aiSummary:
            warnings.length > 0
              ? `${aiSummary} (${warnings.join(" ")})`
              : aiSummary,
        },
        update: {
          topPainPoints: summary.topPainPoints,
          topWishlist: summary.topWishlist,
          influencers: summary.influencers,
          viralContent: summary.viralContent,
          categoryBreakdown: summary.categoryBreakdown,
          aiSummary:
            warnings.length > 0
              ? `${aiSummary} (${warnings.join(" ")})`
              : aiSummary,
        },
      }),
      prisma.socialListeningBatch.update({
        where: { id: batch.id },
        data: {
          status: SocialListeningStatus.READY,
          collectedAt: new Date(),
          errorMessage: warnings.length > 0 ? warnings.join(" | ") : null,
        },
      }),
    ]);

    return { batchId: batch.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync gagal";
    await prisma.socialListeningBatch.update({
      where: { id: batch.id },
      data: {
        status: SocialListeningStatus.FAILED,
        errorMessage: message,
      },
    });
    throw err;
  }
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
